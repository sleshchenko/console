
angular.module('k8s')
.service('k8sProbe', function(_, k8sEnum) {
  'use strict';

  var flatteners, parsers;

  parsers = {
    exec: function(str) {
      return {
        command: str.split(' '),
      };
    },

    httpGet: function(str) {
      if (!str) {
        return null;
      }
      // XXX: Kubernetes allows for named ports, but the URL spec says ports must be digits.
      let scheme, path, port, host, hostname, rest;
      [scheme, ...rest] = str.split('://');
      if (!scheme) {
        return null;
      }
      str = rest.join();
      [host, ...rest] = str.split('/');
      path = `/${rest.join()}`;
      [hostname, port] = host.split(':');
      if (_.isUndefined(port)) {
        if (scheme === 'http') {
          port = 80;
        } else if (scheme === 'https') {
          port = 443;
        }
      }
      if (_.isUndefined(port)) {
        return null;
      }
      return {
        host: [scheme, '://', hostname].join(''),
        path: path,
        port: parseInt(port, 10) || port,
      };
    },

    tcpSocket: function(str) {
      if (str == null || str === '') {
        return null;
      }

      return {
        // as per http://kubernetes.io/docs/api-reference/v1/definitions/#_v1_tcpsocketaction
        // port can be either number or IANA name
        port: /^\d+$/.test(str) ? (+str) : str,
      };
    },
  };

  flatteners = {
    exec: function(cmd) {
      if (_.isEmpty(cmd) || _.isEmpty(cmd.command)) {
        return '';
      }
      return cmd.command.join(' ');
    },

    httpGet: function(cmd) {
      var c = '';
      if (_.isEmpty(cmd)) {
        return c;
      }
      c += cmd.host;
      if (cmd.port) {
        c += `:${cmd.port}`;
      }
      if (cmd.path) {
        c += cmd.path;
      }
      return c;
    },

    tcpSocket: function(cmd) {
      if (!cmd || !cmd.port) {
        return '';
      }
      return `${cmd.port}`;
    },
  };

  function inferAction(obj) {
    var keys;
    if (_.isEmpty(obj)) {
      return;
    }
    keys = _.keys(obj);
    if (_.isEmpty(keys)) {
      return;
    }
    return k8sEnum.HookAction[keys[0]];
  }

  function flattenCmd(type, cmd) {
    return flatteners[type](cmd);
  }

  function parseCmd(type, cmd) {
    return parsers[type](cmd);
  }

  function getActionLabelById(actionId) {
    var t = k8sEnum.HookAction[actionId];
    if (t) {
      return t.label;
    }
    return '';
  }

  function getActionLabel(action) {
    if (action) {
      return action.label;
    }
    return '';
  }

  function getActionLabelFromObject(obj) {
    var a = inferAction(obj);
    return getActionLabel(a);
  }

  this.flattenCmd = flattenCmd;
  this.parseCmd = parseCmd;
  this.getActionLabelFromObject = getActionLabelFromObject;
  this.getActionLabelById = getActionLabelById;

  this.getLifecycleHookLabel = function(lifecycle, stage) {
    if (!lifecycle || !stage || !lifecycle[stage]) {
      return '';
    }
    return getActionLabelFromObject(lifecycle[stage]);
  };

  // Maps an api config object to a simple flattened type and command field.
  this.mapLifecycleConfigToFields = function(c) {
    var k, f;

    f = {
      postStart: {
        type: 'exec',
        cmd: '',
      },
      preStop: {
        type: 'exec',
        cmd: '',
      },
    };

    if (!c) {
      return f;
    }

    if (!_.isEmpty(c.postStart)) {
      k = _.keys(c.postStart);
      f.postStart.type = k[0];
      f.postStart.cmd = flattenCmd(k[0], c.postStart[k[0]]);
    }

    if (!_.isEmpty(c.preStop)) {
      k = _.keys(c.preStop);
      f.preStop.type = k[0];
      f.preStop.cmd = flattenCmd(k[0], c.preStop[k[0]]);
    }

    return f;
  };

  this.mapFieldsToLifecycleConfig = function(f) {
    var c = {};
    if (_.isEmpty(f.postStart.cmd) && _.isEmpty(f.preStop.cmd)) {
      return null;
    }

    if (!_.isEmpty(f.postStart.cmd)) {
      c.postStart = {};
      c.postStart[f.postStart.type] = parseCmd(f.postStart.type, f.postStart.cmd);
    }

    if (!_.isEmpty(f.preStop.cmd)) {
      c.preStop = {};
      c.preStop[f.preStop.type] = parseCmd(f.preStop.type, f.preStop.cmd);
    }

    if (_.isEmpty(c)) {
      return null;
    }

    return c;
  };

  this.mapFieldsToLivenessProbe = function(f) {
    var delay, c = {};
    if (f.cmd == null || f.cmd === '') {
      return null;
    }

    c[f.type] = parseCmd(f.type, f.cmd);
    delay = parseInt(f.initialDelaySeconds, 10);

    // NaN is a number :/
    if (_.isNumber(delay) && !_.isNaN(delay)) {
      c.initialDelaySeconds = f.initialDelaySeconds;
    }

    return c;
  };

  this.mapLivenessProbeToFields = function(c) {
    var k, f;

    f = {
      initialDelaySeconds: '',
      type: 'exec',
      cmd: '',
    };

    if (_.isEmpty(c)) {
      return f;
    }

    if (_.isNumber(parseInt(c.initialDelaySeconds, 10))) {
      f.initialDelaySeconds = c.initialDelaySeconds;
    }

    k = _.keys(c);
    if (!_.isEmpty(k)) {
      f.type = k[0];
      f.cmd = flattenCmd(k[0], c[k[0]]);
    }

    return f;
  };

});
