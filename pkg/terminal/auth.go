package terminal

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// isClusterAdmin checks if the specified user belongs to cluster admin group or not.
func (p *Proxy) isClusterAdmin(userInfo *unstructured.Unstructured) (bool, error) {
	groups, isFound, err := unstructured.NestedStringSlice(userInfo.UnstructuredContent(), "groups")
	if err != nil {
		return false, err
	}
	if !isFound {
		return false, nil
	}

	for _, group := range groups {
		if group == "system:cluster-admins" {
			return true, nil
		}
	}
	return false, nil
}
