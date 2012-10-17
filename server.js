/**
 * chat server
 *
 * @legend
 * 2012 UGiA.CN ResMx.COM
 */

var LISTEN_PORT = 8001;

var MSG_TYPE_USER = 'msg';
var MSG_TYPE_SYS = 'sys';
var DEFALUT_CALLBACK = 'render';

var url = require('url');
var http = require('http');
var fs = require('fs');
var path = require("path");

// global msgs object
var msgs = (function () {
    var POOL_SIZE = 1000;
    var HISTORY_SIZE = 20;

    var idx = 0;
    var pool = [];

    function post(type, sid, nick, msg)
    {
        idx ++;

        var ts = new Date().getTime();
        var msg = msg || '';
        var nick = nick || '';

        pool.push({id: idx, type: type, sid: sid, nick: nick, ts: ts, msg: msg});
        if (pool.length > POOL_SIZE) {
            pool.shift();
        }

        conns.flush();
        
        return idx;
    }

    function get(since)
    {
        var since = since || 0;
        var since = since == 0 ? idx - HISTORY_SIZE : since;
        var rows = [];

        for (i = since; i <= idx; i ++) {
        	if (pool[i]) {
                rows.push(pool[i]);
            }
        }

        return rows;
    }

    return {"post": post, "get": get};
})();



// connections pool object
var conns = (function () {
    var MAX_LIFE = 120;
    var REAP_INTERVAL = 30;
    var pool = {};

    function renew(sid, res, nick, since)
    {
        var since = since || 0;
        var ts = new Date().getTime();

        res.session = {sid: sid, nick: nick, ts: ts, since: since};
        res.on('push', function (msg) {
            this.end(render(0, msg));
        });

        if (!pool[sid]) {
            msgs.post(MSG_TYPE_SYS, sid, nick, 'join');
        }

        pool[sid] = res;
    }

    function flush()
    {
        for (sid in pool) {
            var rows = msgs.get(pool[sid].session.since);
            pool[sid].emit('push', rows);
        }
    }

    function list()
    {
        var users = {};
        for (sid in pool) {
            users[sid] = {sid: sid, nick: pool[sid].session.nick, ts: pool[sid].session.ts};
        }

        return users;
    }
    //
    function touch(sid)
    {
        if (!pool[sid]) {
            return false;
        }

        pool[sid].session.ts = new Date().getTime();

        return true;
    }

    function reap()
    {
        var cts = new Date().getTime();
        for (sid in pool) {
            console.log(cts, pool[sid].session.ts, MAX_LIFE);
            if (cts - pool[sid].session.ts > MAX_LIFE * 1000) {
                close(sid);
            }
        }

    	return true;    
    }

    function close(sid)
    {
        console.log('close ' + sid);
        msgs.post(MSG_TYPE_SYS, sid, pool[sid].session.nick, 'exit');
        delete(pool[sid]);
    }

    setInterval(reap, REAP_INTERVAL * 1000);

    return {renew: renew, flush: flush, list: list};
})();


// router
var router = (function () {
    var self = this;
    var map = {'GET': {}, 'POST': {}};

    function add(path, handle, method){
        var method = method || 'GET';
        method = method.toUpperCase();

        if (typeof map[method][path] == 'undefined') {
            map[method][path] =  [];    
        }

        map[method][path].push(handle);

        return true;
    }

    function route(path, method)
    {
        var method = method || 'GET';
        method = method.toUpperCase();

         if (path.length > 1) {
            path = path.replace(/\/$/, '');
        }

        if (typeof map[method][path] != 'undefined') {
            return map[method][path];
        }

        return false;
    }

    return {"add": add, "route": route};
})();

// dispatcher
var dispatcher = (function () {

    var mime = {
      "css": "text/css",
      "gif": "image/gif",
      "html": "text/html",
      "ico": "image/x-icon",
      "jpeg": "image/jpeg",
      "jpg": "image/jpeg",
      "js": "text/javascript",
      "json": "application/json",
      "pdf": "application/pdf",
      "png": "image/png",
      "txt": "text/plain",
      "xml": "text/xml"
    };

    function disptch(req, res)
    {
        var method = req.method.toUpperCase();
        var q = url.parse(req.url, true);
        var para = q.query;
        var path = q.pathname;

        var handles = router.route(path, method);
        if (!handles) {
            sendFile(path, res);
        } else {
            for (var i = 0; i < handles.length; i ++) {
                handles[i](req, res, para);
            }
        }

        return true;
    }

    function sendFile(p, res)
    {
        p = '.' + p.replace(/\.\.[\/\\]/g, '');
        console.log(p);

        var ext = path.extname(p).slice(1).toLowerCase();
        fs.exists(p, function (exists) {
            if (!exists) {
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end();
                return false;
            }

            var contents = fs.readFileSync(p);
            if (contents === false) {
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.end();
            } else {
                var type = mime[ext] || 'text/plain';
                res.writeHead(200, {'Content-Type': type});
                res.end(contents);
            }

          });
    }

    return {"disptch": disptch};
})();


// rules
router.add('/', function (req, res, para) {
    res.end(fs.readFileSync('./index.html'));
    console.log('/');
    res.end(render(0, 'index'));
});

router.add('/join', function (req, res, para) {
    var nick = para.nick || '';
    if (nick === '') {
        res.end(render(2, 'missing nickname'));
        return false;
    }

    var sid = new Date().getTime() + Math.round(Math.random() * 10000);

    conns.renew(sid, res, nick);
    res.end(render(0, sid));

    console.log('join ' + sid);
});


router.add('/get', function (req, res, para) {
    if (!para.sid || !para.nick) {
        res.end(render(1, 'missing param'));
        return false;
    }

    var since = para.since || 0;
    var rows = msgs.get(since);
    if (rows.length) {
        res.end(render(0, rows));
    }

    conns.renew(para.sid, res, para.nick, since);

    console.log('get', rows);
});


router.add('/post', function (req, res, para) {
    if (!para.sid || !para.nick || !para.msg) {
        res.end(render(1, 'missing param'));
        return false;
    }

    msgs.post(MSG_TYPE_USER, para.sid, para.nick, para.msg);

    res.end(render(0, 'sent'));

    return true;
});


router.add('/list', function (req, res, para) {
    var users = conns.list();
    res.end(render(0, users));
});


function render(errno, msg)
{
    var res = {errno: errno, msg: msg};
    return JSON.stringify(res);
}



// server
var server = http.createServer(function (req, res) {
    dispatcher.disptch(req, res);
});

server.on('error', function (e) {
    console.log(e);
});

server.listen(LISTEN_PORT);
