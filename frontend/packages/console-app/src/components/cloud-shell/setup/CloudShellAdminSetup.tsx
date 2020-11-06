import * as React from 'react';
import { connect } from 'react-redux';

import { k8sCreate, k8sGet } from '@console/internal/module/k8s';
import { WorkspaceModel } from '../../../models';
import {
  newCloudShellWorkSpace,
  createCloudShellResourceName,
  CLOUD_SHELL_PROTECTED_NAMESPACE,
} from '../cloud-shell-utils';
import { NamespaceModel } from '@console/internal/models';
import TerminalLoadingBox from '../TerminalLoadingBox';
import { LoadError } from '@console/internal/components/utils/status-box';
import { useTranslation } from 'react-i18next';

type Props = {
  onInitialize?: (namespace: string) => void;
};

const CloudShellAdminSetup: React.FunctionComponent<Props> = ({ onInitialize }) => {
  const { t } = useTranslation();

  const [initError, setInitError] = React.useState<string>();

  React.useEffect(() => {
    (async () => {
      async function namespaceExists(): Promise<boolean> {
        try {
          await k8sGet(NamespaceModel, CLOUD_SHELL_PROTECTED_NAMESPACE);
          return true;
        } catch (error) {
          const namespaceError = `namespaces "${CLOUD_SHELL_PROTECTED_NAMESPACE}" not found`;
          if (error.message !== namespaceError) {
            setInitError(error);
          }
          return false;
        }
      }

      if (initError) {
        return;
      }

      try {
        const protectedNamespaceExists = await namespaceExists();
        if (!protectedNamespaceExists) {
          await k8sCreate(NamespaceModel, {
            metadata: {
              name: CLOUD_SHELL_PROTECTED_NAMESPACE,
            },
          });
        }
        await k8sCreate(
          WorkspaceModel,
          newCloudShellWorkSpace(createCloudShellResourceName(), CLOUD_SHELL_PROTECTED_NAMESPACE),
        );
        onInitialize && onInitialize(CLOUD_SHELL_PROTECTED_NAMESPACE);
      } catch (error) {
        setInitError(error);
      }
    })();
  }, [initError, onInitialize, t]);

  if (initError) {
    return (
      <LoadError message={initError} label={t('cloudshell~OpenShift command line terminal')} />
    );
  }

  return (
    <div className="co-cloudshell-terminal__container">
      <TerminalLoadingBox />
    </div>
  );
};

export default connect()(CloudShellAdminSetup);
