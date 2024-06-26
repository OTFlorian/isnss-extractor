document.addEventListener('DOMContentLoaded', function () {
  const extractButton = document.getElementById("extractButton");
  const toggleFormat = document.getElementById("toggleFormat");
  const prefixFormat = document.getElementById("prefixFormat");
  const plaintiffDefendantFormat = document.getElementById("plaintiffDefendantFormat");
  const statusMessage = document.getElementById("statusMessage");
  const updateMessage = document.getElementById("updateMessage");

  if (extractButton) {
      extractButton.addEventListener("click", () => {
          statusMessage.style.display = 'block';
          statusMessage.textContent = "Čekejte...";
          statusMessage.className = "status-message";

          const includeVRizeni = toggleFormat.checked;
          const selectedPrefixFormat = prefixFormat.checked ? "č. j." : "čj.";
          const useNavrhovatel = plaintiffDefendantFormat.checked ? "true" : "false";

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const activeTab = tabs[0];
              chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ["content.js"]
              }, () => {
                  chrome.tabs.sendMessage(activeTab.id, {
                      action: "extractInfo",
                      includeVRizeni: includeVRizeni,
                      prefixFormat: selectedPrefixFormat,
                      useNavrhovatel: useNavrhovatel
                  }, (response) => {
                      console.log("Response from content script:", response); // Debug log
                      if (response && response.success) {
                          statusMessage.textContent = "Text úspěšně zkopírován do schránky.";
                          statusMessage.className = "status-message success";
                      } else {
                          const errorMessage = response ? response.error : "No response from content script";
                          statusMessage.innerHTML = `Chyba při kopírování textu: ${errorMessage}<br><button id="copyError">Zkopírovat chybovou zprávu</button>`;
                          statusMessage.className = "status-message error";

                          document.getElementById("copyError").addEventListener("click", () => {
                              navigator.clipboard.writeText(errorMessage).then(() => {
                                  statusMessage.textContent = "Chybová zpráva úspěšně zkopírována do schránky.";
                              }).catch(err => {
                                  console.error("Chyba při kopírování chybové zprávy:", err);
                              });
                          });
                      }
                  });
              });
          });
      });
  }

  // Handle link clicks
  const externalLinks = document.querySelectorAll('.external-link');
  externalLinks.forEach(link => {
      link.addEventListener('click', function(event) {
          event.preventDefault();
          chrome.tabs.create({ url: link.href });
      });
  });

  checkForUpdate();

  async function checkForUpdate() {
      const currentVersion = chrome.runtime.getManifest().version;
      try {
          const response = await fetch('https://raw.githubusercontent.com/OTFlorian/isnss-extractor/main/manifest.json');
          const data = await response.json();
          const latestVersion = data.version;

          if (isNewerVersion(currentVersion, latestVersion)) {
              updateMessage.innerHTML = `Je k dispozici nová verze: <a href="https://github.com/OTFlorian/isnss-extractor" class="external-link" target="_blank">${latestVersion}</a>`;
              updateMessage.classList.add('update-available');
          }
      } catch (error) {
          console.error('Error checking for update:', error);
      }
  }

  function isNewerVersion(current, latest) {
      const currentParts = current.split('.').map(Number);
      const latestParts = latest.split('.').map(Number);
      
      for (let i = 0; i < latestParts.length; i++) {
          if (latestParts[i] > (currentParts[i] || 0)) {
              return true;
          } else if (latestParts[i] < (currentParts[i] || 0)) {
              return false;
          }
      }
      return false;
  }
});
