import './_module';
import './docker';
import './enum';
import './events';
import './selector';
import './selector-requirement';
import './labels';
import './node';
import './pods';
import './probe';
import './replicationcontrollers';
import './replicasets';
import './deployments';
import './resource';
import './services';
import './command';
import './configmaps';

import {wsFactory} from '../ws-factory';


export const getQN = ({metadata: {name, namespace}}) => (namespace ? `(${namespace})-` : '') + name;

angular.module('k8s')
.provider('k8sConfig', function() {
  'use strict';

  var basePath;
  var apiVersion;

  this.setKubernetesPath = function(path, version) {
    basePath = path;
    apiVersion = version;
  };
  this.$get = function() {
    return {
      getKubernetesAPIPath: function(kind) {
        let p = basePath;

        if (kind.isExtension) {
          p += '/apis/extensions/';
        } else if (kind.basePath) {
          p += kind.basePath;
        } else {
          p += '/api/';
        }

        p += kind.apiVersion || apiVersion;

        return p;
      },
      getBasePath: function() {
        return basePath;
      },
      getk8sFlagPaths: function () {
        return {
          rbac: '/apis/rbac.authorization.k8s.io',
          rbacV1alpha1: '/apis/rbac.authorization.k8s.io/v1alpha1',
        };
      },
    };
  };
})
.service('k8s', function(_, $http, $timeout, $rootScope, k8sConfig, k8sEvents, k8sEnum, k8sResource, k8sLabels,
                         k8sPods, k8sServices, k8sDocker, k8sReplicationcontrollers, k8sReplicaSets,
                         k8sDeployments, k8sProbe, k8sNodes, k8sSelector, k8sSelectorRequirement, k8sCommand, featuresSvc, k8sConfigmaps) {
  'use strict';
  this.getQN = getQN;
  this.probe = k8sProbe;
  this.selector = k8sSelector;
  this.selectorRequirement = k8sSelectorRequirement;
  this.labels = k8sLabels;
  this.events = k8sEvents;
  this.enum = k8sEnum;
  this.docker = k8sDocker;
  this.resource = k8sResource;
  this.search = k8sResource.list;
  this.command = k8sCommand;

  const addDefaults = (k8sObject, kind) => {
    return _.assign({
      list: _.partial(k8sResource.list, kind),
      get: _.partial(k8sResource.get, kind),
      delete: _.partial(k8sResource.delete, kind),
      create: function(obj) {
        k8sObject.clean && k8sObject.clean(obj);
        return k8sResource.create(kind, obj);
      },
      update: function(obj) {
        k8sObject.clean && k8sObject.clean(obj);
        return k8sResource.update(kind, obj);
      },
      patch: function (obj, payload) {
        return k8sResource.patch(kind, obj, payload);
      },
      watch: query => {
        const path = k8sResource.resourceURL2(kind, query.ns, true, query.labelSelector, query.fieldSelector);

        const opts = {
          scope: $rootScope,
          host: 'auto',
          reconnect: true,
          path: path,
          jsonParse: true,
          bufferEnabled: true,
          bufferFlushInterval: 500,
          bufferMax: 1000,
        };
        return wsFactory(kind.labelPlural, opts);
      },
      kind: kind,
    }, k8sObject);
  };

  this.kinds = k8sEnum.Kind;
  this.configmaps = addDefaults(k8sConfigmaps, k8sEnum.Kind.CONFIGMAP);
  this.nodes = addDefaults(k8sNodes, k8sEnum.Kind.NODE);
  this.services = addDefaults(k8sServices, k8sEnum.Kind.SERVICE);
  this.pods = addDefaults(k8sPods, k8sEnum.Kind.POD);
  this.containers = addDefaults({}, k8sEnum.Kind.CONTAINER);
  this.replicationcontrollers = addDefaults(k8sReplicationcontrollers, k8sEnum.Kind.REPLICATIONCONTROLLER);
  this.replicasets = addDefaults(k8sReplicaSets, k8sEnum.Kind.REPLICASET);
  this.deployments = addDefaults(k8sDeployments, k8sEnum.Kind.DEPLOYMENT);
  this.jobs = addDefaults({}, k8sEnum.Kind.JOB);
  this.daemonsets = addDefaults({}, k8sEnum.Kind.DAEMONSET);
  this.horizontalpodautoscalers = addDefaults({}, k8sEnum.Kind.HORIZONTALPODAUTOSCALER);
  this.serviceaccounts = addDefaults({}, k8sEnum.Kind.SERVICEACCOUNT);
  this.secrets = addDefaults({}, k8sEnum.Kind.SECRET);

  this.componentstatuses = addDefaults({}, k8sEnum.Kind.COMPONENTSTATUS);
  this.namespaces = addDefaults({}, k8sEnum.Kind.NAMESPACE);

  this.clusterrolebindings = addDefaults({}, k8sEnum.Kind.CLUSTERROLEBINDING);
  this.clusterroles = addDefaults({}, k8sEnum.Kind.CLUSTERROLE);
  this.rolebindings = addDefaults({}, k8sEnum.Kind.ROLEBINDING);
  this.roles = addDefaults({}, k8sEnum.Kind.ROLE);

  this.health = function() {
    return $http({
      url: k8sConfig.getBasePath(),
      method: 'GET'
    });
  };

  this.version = function() {
    return $http({
      url: k8sConfig.getBasePath() + '/version',
      method: 'GET'
    });
  };

  this.featureDetection = () => {
    $http({
      url: k8sConfig.getBasePath(),
      method: 'GET',
    })
    .then(res => {
      const paths = res.data.paths;
      _.each(k8sConfig.getk8sFlagPaths(), (path, flag) => {
        featuresSvc[flag] = paths.indexOf(path) >= 0;
      });
    })
    .catch(e => {
      // eslint-disable-next-line no-console
      console.error(e);
      $timeout(this.featureDetection, 5000);
    });
  };
});
