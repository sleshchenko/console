package terminal

import (
	"crypto/tls"
	"fmt"
	"github.com/openshift/console/pkg/auth"
	"github.com/openshift/console/pkg/proxy"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"net/http"
	"net/url"
	"strings"
)

const (
	TerminalEndpoint = "/api/terminal/"
)

// helmHandlers provides handlers to handle helm related requests
type TerminalProxy struct {
	TLSClientConfig *tls.Config
	ClusterEndpoint *url.URL
}

func (t *TerminalProxy) Handle(user *auth.User, w http.ResponseWriter, r *http.Request) {
	// -> 0   1    2      3           4          5             6
	// ->   /api/proxy/{namespace}/{workspace-name}/{path}
	segments := strings.SplitN(r.URL.Path, "/", 6)
	if len(segments) < 5 {
		http.NotFound(w, r)
	} else {
		namespace := segments[3]
		workspaceName := segments[4]
		var path string
		if len(segments) == 6 {
			path = segments[5]
		}

		ws, err := t.getWorkspace(user, namespace, workspaceName)

		if err != nil {
			http.Error(w, "Failed to get the requesed workspace. Cause: "+err.Error(), http.StatusForbidden)
			return
		}

		creator := ws.GetAnnotations()["org.eclipse.che.workspace/creator"]
		if creator != user.ID {
			http.Error(w, "User is not a owner of the requested workspace", http.StatusForbidden)
			return
		}

		ideUrl, success, err := unstructured.NestedString(ws.UnstructuredContent(), "status", "ideUrl")
		if !success || err != nil {
			http.Error(w, "Received workspace does not have ideUrl in its status", http.StatusInternalServerError)
			return
		}

		terminalUrl, err := url.Parse(ideUrl)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to parse workspace ideUrl %s", ideUrl), http.StatusInternalServerError)
			return
		}

		terminalHost, err := url.Parse(terminalUrl.Scheme + "://" + terminalUrl.Host)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to parse workspace ideUrl host %s", ideUrl), http.StatusInternalServerError)
			return
		}

		t.proxyToWorkspace(terminalHost, path, user, r, w)
	}
}

func (t *TerminalProxy) proxyToWorkspace(host *url.URL, path string, user *auth.User, r *http.Request, w http.ResponseWriter) {
	r2 := new(http.Request)
	*r2 = *r
	r2.URL = new(url.URL)
	*r2.URL = *r.URL

	r2.Header.Set("X-Forwarded-Access-Token", user.Token)

	r2.URL.Path = path

	//TODO a new proxy per request is created. Must be revised and probably changed
	terminalProxy := proxy.NewProxy(&proxy.Config{
		Endpoint:        host,
		TLSClientConfig: t.TLSClientConfig,
	})

	terminalProxy.ServeHTTP(w, r2)
}

func (t *TerminalProxy) getWorkspace(user *auth.User, namespace string, name string) (*unstructured.Unstructured, error) {
	tlsClientConfig := rest.TLSClientConfig{}
	tlsClientConfig.Insecure = true
	config := &rest.Config{
		// TODO: switch to using cluster DNS.
		Host:            t.ClusterEndpoint.Host,
		TLSClientConfig: tlsClientConfig,
		BearerToken:     user.Token,
	}

	config.BearerToken = user.Token

	client, err := dynamic.NewForConfig(dynamic.ConfigFor(config))
	if err != nil {
		return nil, err
	}
	return client.Resource(schema.GroupVersionResource{
		Group:    "workspace.che.eclipse.org",
		Version:  "v1alpha1",
		Resource: "workspaces",
	}).Namespace(namespace).Get(name, metav1.GetOptions{})
}
