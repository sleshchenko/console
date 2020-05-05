import { K8sResourceKind } from '@console/internal/module/k8s';
import { getRandomChars } from '@console/shared';

type environment = {
  value: string;
  name: string;
};
type DevfileComponent = {
  type?: string;
  id?: string;
  reference?: string;
  memoryLimit?: string;
  alias?: string;
  image?: string;
  args?: string[];
  env?: environment[];
};

interface Devfile {
  metadata: {
    name: string;
  };
  components: DevfileComponent[];
  apiVersion?: string;
}

export type CloudShellResource = K8sResourceKind & {
  status?: {
    phase: string;
    ideUrl: string;
  };
  spec?: {
    started?: boolean;
    devfile?: Devfile;
  };
};

export const CLOUD_SHELL_LABEL = 'console.openshift.io/cloudshell';
export const CLOUD_SHELL_USER_ANNOTATION = 'console.openshift.io/cloudshell-user';

export const createCloudShellResourceName = () => `terminal-${getRandomChars(6)}`;

export const newCloudShellWorkSpace = (
  name: string,
  namespace: string,
  username: string,
): CloudShellResource => ({
  apiVersion: 'workspace.che.eclipse.org/v1alpha1',
  kind: 'Workspace',
  metadata: {
    name,
    namespace,
    labels: {
      [CLOUD_SHELL_LABEL]: 'true',
    },
    annotations: {
      [CLOUD_SHELL_USER_ANNOTATION]: username,
    },
  },
  spec: {
    started: true,
    devfile: {
      apiVersion: '0.0.1',
      metadata: {
        name: 'cloud-shell',
      },
      components: [
        {
          alias: 'cloud-shell',
          type: 'cheEditor',
          reference: 'https://gist.githubusercontent.com/sleshchenko/0f6409a6382c122a38099206265bd5db/raw/facaebc6693e998096137b4c71f7dd3cc7a4a4e9/meta.yaml',
        },
        {
          type: 'dockerimage',
          memoryLimit: '256Mi',
          alias: 'dev',
          image: 'quay.io/eclipse/che-sidecar-openshift-connector:0.1.2-2601509',
          args: ['tail', '-f', '/dev/null'],
          env: [
            {
              value: '\\[\\e[34m\\]>\\[\\e[m\\]\\[\\e[33m\\]>\\[\\e[m\\]',
              name: 'PS1',
            },
          ],
        },
      ],
    },
  },
});
