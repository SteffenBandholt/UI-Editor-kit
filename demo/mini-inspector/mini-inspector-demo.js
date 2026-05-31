(function () {
  "use strict";

  var adapter = window.miniInspectorHostAdapter;
  var DEFAULT_SCOPE = adapter.DEFAULT_SCOPE;

  function updateDemo() {
    var rootElement = document.getElementById("miniInspectorDemoTarget");
    var inspectorContainer = document.getElementById("miniInspectorStatus");
    var invalidToggle = document.getElementById("demoInvalidToggle");

    return adapter.updateMiniInspectorHostAdapter(rootElement, inspectorContainer, {
      invalid: invalidToggle.checked,
      scope: DEFAULT_SCOPE,
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var invalidToggle = document.getElementById("demoInvalidToggle");
    invalidToggle.addEventListener("change", updateDemo);
    updateDemo();
  });

  window.miniInspectorBrowserDemo = {
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    createBrowserDemoStatus: adapter.createMiniInspectorHostStatus,
    renderStatus: adapter.renderMiniInspectorHostStatus,
    updateDemo: updateDemo,
  };
})();
