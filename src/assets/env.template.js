(function(window) {
    window["env"] = window["env"] || {};
    // Environment variables
    window["env"]["apiBaseUrl"] = "${API_BASE_URL}";
    window["env"]["agentApiUrl"] = "${AGENT_API_URL}";
    window["env"]["issuer"] = "${ISSUER}";
    window["env"]["clientId"] = "${CLIENTID}";
})(this);