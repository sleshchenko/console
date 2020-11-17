package terminal

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// checkUserPermissions checks if the terminal proxy is supported for a given user.
// Returns true if we're willing to proxy the user's token, false otherwise. We don't
// want to proxy highly privileged tokens to avoid privilege escalation issues.
func (p *Proxy) checkUserPermissions(userInfo *unstructured.Unstructured, namespace string) (bool, error) {
	groups, isFound, err := unstructured.NestedStringSlice(userInfo.UnstructuredContent(), "groups")
	if err != nil {
		return false, err
	}
	if !isFound {
		return false, nil
	}
	if namespace == "openshift-terminal" {
		if isClusterAdmin(groups) {
			return true, nil
		}
		return false, nil
	}
	return true, nil
}

func isClusterAdmin(groups []string) bool {
	for _, group := range groups {
		if group == "system:cluster-admins" {
			return true
		}
	}
	return false
}
