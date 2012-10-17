/**
 * chat client
 *
 * @legend
 * 2012 UGiA.CN ResMx.COM
 */
var client = (function () 
{
    var CHAT_HOST = ''; //local
    var POLLING_TIMEOUT = 30 * 1000;
    var POLLING_ERR_DELAY = 10 * 1000;
    
    var _nick = '';
    var _since = 0;
    var _sid = 0;
    var _callback = null;
    var _options = {cache: false, dataType: 'json', timeout: POLLING_TIMEOUT};

    function init()
    {
        //
    }

    function join(nick, callback)
    {
        if (nick == '') {
            callback(false, 'missing nickname');
            return false;
        }

        var param = {nick: nick};
        var url = CHAT_HOST + '/join?' + $.param(param);

        $.get(url, function (data) {
            if (data.errno != 0) {
                callback(false, data.msg);
                return false;
            }

            _nick = nick;
            _sid = data.msg;
            callback(true);
            polling();
        }, 'json');
    }

    function post(msg, callback)
    {
        if (!$.trim(msg)) {
            callback(false, 'empty message');
            return false;
        }

        var param = {sid: _sid, nick: _nick, msg: msg};
        var url = CHAT_HOST + '/post?' + $.param(param);

        $.get(url, function (data) {
            if (data.errno != 0) {
                callback(false, data.msg);
                return false;
            }

            callback(true);
        }, 'json');

        return true;
    }

    function list(callback)
    {
        var url = CHAT_HOST + '/list';

        $.get(url, function (data) {
            if (data.errno != 0) {
                callback(false, data.msg);
                return false;
            }

            callback(true, data.msg);
        }, 'json');
    }

    function setPollingCallback(callback) {
        _callback = callback;
    }

    function getSid () {
        return _sid;
    }

    function polling()
    {
        var param = {sid: _sid, nick: _nick, since: _since};
        _options.url = CHAT_HOST + '/get?' + $.param(param);

        $.ajax(_options);
    }

    function pollingError (xhr, status) {
        console.log(status);
    }

    function pollingComplete (xhr, status) {
        if (status == 'timeout' || status == 'success') {
            polling();
            return true;
        }

        setTimeout(polling, POLLING_ERR_DELAY);

        return false;
    }


    function pollingEnd(data)
    {
        if (data.msg.length == 0) {
            return true;
        }

        _since = data.msg[data.msg.length - 1].id;
        _callback(data.msg);

        return true;
    }

    _options.complete = pollingComplete;
    _options.error = pollingError;
    _options.success = pollingEnd;

    return {init: init, join: join, post: post, list: list, setPollingCallback: setPollingCallback, getSid: getSid};
})();