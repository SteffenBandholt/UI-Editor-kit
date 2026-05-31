(function () {
  "use strict";

  var adapter = window.miniInspectorHostAdapter;
  var DEFAULT_SCOPE = adapter.DEFAULT_SCOPE;

  function updateHostAppBasic() {
    var rootElement = document.getElementById("hostTargetRoot");
    var inspectorContainer = document.getElementById("hostInspectorContainer");
    var invalidToggle = document.getElementById("hostInvalidToggle");

    return adapter.updateMiniInspectorHostAdapter(rootElement, inspectorContainer, {
      scope: DEFAULT_SCOPE,
      invalid: invalidToggle.checked,
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var invalidToggle = document.getElementById("hostInvalidToggle");
    invalidToggle.addEventListener("change", updateHostAppBasic);
    updateHostAppBasic();
  });

  window.hostAppBasic = {
    DEFAULT_SCOPE: DEFAULT_SCOPE,
    updateHostAppBasic: updateHostAppBasic,
  };
})();
