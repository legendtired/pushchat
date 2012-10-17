/**
 * chat client
 *
 * @legend
 * 2012 UGiA.CN ResMx.COM
 */

$(function () {
    $('#btn_join').bind('click', join);
    $('#txt_nick').bind('keydown', function (event) {
        if (event.keyCode != 13) {
            return true;
        }

        return join();
    });

    $('#txt_input').bind('keydown', function (event) {
        if (event.keyCode != 13) {
            return true;
        }

        var msg = $('#txt_input').val();
        var self = this;
        return !client.post(msg, function (status, msg) {
            if (false == status) {
                alert(msg);
                $(self).focus();
                return false;
            }

            $(self).val('');
            return true;
        });
    });

    client.setPollingCallback(function (msgs) {
        for (var i = 0; i < msgs.length; i ++) {
            var msg = msgs[i];
            since = msg.id;
            var cname = client.getSid() == msg.sid ? 'sent' : 'recv';
            if (msg.type == 'msg') {
                var html = '<li class="' + cname + '"><div class="msg">' + escapeHtml(msg.msg) + '</div><div class="meta">' + escapeHtml(msg.nick) + ' ' + formatTime(msg.ts) + '</div><div class="pointer ' + cname + '_pointer"></div></li>';
            } else {
                var html = '<li class="sys">' + escapeHtml(msg.nick) + ' ' + escapeHtml(msg.msg) + '</li>';
            }

            $('#msg_list').append(html);
        }

        $("#content").animate({scrollTop: $('#msg_list')[0].scrollHeight}, 100);
    });

    function join() {
        var nick = $('#txt_nick').val();
        client.join(nick, function (status, msg) {
            if (!status) {
                alert(msg);
                $('#txt_nick').focus();
                return false;
            }

            $('#join').hide();
            $('#labl_join').html('Messages');
        });
    }

    function refreshList(status, msg) {
        if (!status) {
            return false;
        }

        var html = '';
        for (var sid in msg) {
            var user = msg[sid];
            var cname = user.sid == client.getSid() ? 'hl' : '';
            html += '<li>' + escapeHtml(user.nick) + '<div class="' + cname + '"></div></li>';
            $('#online_list').html(html);
        }
    }

    setInterval(function () {
        client.list(refreshList);
    }, 10 * 1000)
});

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
}

function formatTime(ts)
{
    var time = new Date(ts);
    var h = time.getHours(); // 0-24 format
    var m = time.getMinutes();
    m = m < 10 ? '0' + m : m;

    return h + ':' + m;
}