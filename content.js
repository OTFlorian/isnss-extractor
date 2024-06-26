/**
 * Main function to extract and format the court decision information.
 * @param {boolean} includeVRizeni - Whether to include "v řízení" in the formatted text.
 * @param {string} prefixFormat - The prefix format to use (e.g., "č. j." or "čj.").
 * @param {boolean} useNavrhovatel - Whether to use "navrhovatel" instead of "žalobce".
 * @returns {string} - The formatted court decision information.
 */
async function extractInformation(includeVRizeni, prefixFormat, useNavrhovatel) {
    try {
        const courtDecision = extractCourtDecision();
        const parties = await extractAllParties();
        const defendantDecisions = extractDefendantDecisions();
        const formattedText = formatInformation(courtDecision, parties, defendantDecisions, includeVRizeni, prefixFormat, useNavrhovatel);

        console.log("Formatted text:", formattedText);
        return formattedText;
    } catch (err) {
        console.error("Error extracting information:", err);
        throw err;
    }
}

/**
 * Extract all parties involved in the court case.
 * @returns {object} - An object containing arrays of plaintiffs, defendants, complainants, and interested parties.
 */
async function extractAllParties() {
    const plaintiffs = await extractPersons('žalobce/navrhovatel 1.st');
    const defendants = await extractPersons('žalovaný/odpůrce 1.st');
    const complainants = await extractPersons('stěžovatel');
    const interestedParties = await extractPersons('osoba zúčastněná');
    return { plaintiffs, defendants, complainants, interestedParties };
}

/**
 * Format the extracted information into a readable text format.
 * @param {object} courtDecision - The court decision details.
 * @param {object} parties - The parties involved in the court case.
 * @param {array} defendantDecisions - The decisions made by the defendants.
 * @param {boolean} includeVRizeni - Whether to include "v řízení" in the formatted text.
 * @param {string} prefixFormat - The prefix format to use (e.g., "č. j." or "čj.").
 * @param {boolean} useNavrhovatel - Whether to use "navrhovatel" instead of "žalobce".
 * @returns {string} - The formatted court decision information.
 */
function formatInformation(courtDecision, parties, defendantDecisions, includeVRizeni, prefixFormat, useNavrhovatel) {
    let formattedText = `v právní věci `;

    const plaintiffRole = useNavrhovatel ? 'navrhovatelů' : 'žalobců';
    const defendantRole = useNavrhovatel ? 'odpůrcům' : 'žalovaným';
    const singularPlaintiffRole = useNavrhovatel ? 'navrhovatele' : 'žalobce';
    const singularDefendantRole = useNavrhovatel ? 'odpůrci' : 'žalovanému';

    formattedText += formatParties(parties.plaintiffs, plaintiffRole, singularPlaintiffRole);
    formattedText += `, proti ${formatParties(parties.defendants, defendantRole, singularDefendantRole)}`;

    if (parties.interestedParties.length > 0) {
        formattedText += `, za účasti ${parties.interestedParties.length > 1 ? 'osob zúčastněných na řízení' : 'osoby zúčastněné na řízení'}: `;
        formattedText += formatInterestedParties(parties.interestedParties);
    }

    formattedText += formatDefendantDecisions(defendantDecisions, parties.defendants, prefixFormat);
    let complainantRole = getComplainantRole(parties.complainants, parties.plaintiffs, parties.defendants, parties.interestedParties, useNavrhovatel);
    complainantRole = complainantRole.trim();

    formattedText += `${includeVRizeni ? ' v řízení' : ''} o kasační stížnosti ${complainantRole} proti ${courtDecision.lowerCourtDecisionForm} ${courtDecision.lowerCourtName} ze dne ${courtDecision.lowerCourtDecisionDate}, ${prefixFormat} ${courtDecision.lowerCourtDecisionRef},`;

    return formattedText;
}

/**
 * Format the parties information.
 * @param {array} parties - The parties involved in the court case.
 * @param {string} pluralRole - The role of the parties in plural form.
 * @param {string} singularRole - The role of the parties in singular form.
 * @returns {string} - The formatted parties information.
 */
function formatParties(parties, pluralRole, singularRole) {
    return parties.length > 1 ? formatMultipleParties(parties, pluralRole) : formatSingleParty(parties[0], singularRole);
}

/**
 * Format the interested parties information.
 * @param {array} interestedParties - The interested parties involved in the court case.
 * @returns {string} - The formatted interested parties information.
 */
function formatInterestedParties(interestedParties) {
    return interestedParties.map((party, index) => {
        let formattedText = party.label ? `${party.label} ${formatPersonText(party)}` : formatPersonText(party);
        return formattedText.trim();
    }).join(', ');
}

/**
 * Format the defendant decisions information.
 * @param {array} defendantDecisions - The decisions made by the defendants.
 * @param {array} defendants - The defendants involved in the court case.
 * @param {string} prefixFormat - The prefix format to use (e.g., "č. j." or "čj.").
 * @returns {string} - The formatted defendant decisions information.
 */
function formatDefendantDecisions(defendantDecisions, defendants, prefixFormat) {
    if (defendantDecisions.length === 1) {
        const decision = defendantDecisions[0];
        const caseNumberPart = decision.caseNumber !== "nevyplněno" ? `sp. zn. ${decision.caseNumber}, ` : "";
        const defendant = defendants.find(d => d.name === decision.defendant);
        return `, proti rozhodnutí žalovaného${defendants.length > 1 ? ` ${defendant.label}` : ''} ze dne ${decision.date}, ${caseNumberPart}${prefixFormat} ${decision.ref},`;
    } else {
        return formatMultipleDefendantDecisions(defendantDecisions, defendants, prefixFormat);
    }
}

/**
 * Determine the role of the complainant(s) in the formatted text.
 * @param {array} complainants - The complainants involved in the court case.
 * @param {array} plaintiffs - The plaintiffs involved in the court case.
 * @param {array} defendants - The defendants involved in the court case.
 * @param {array} interestedParties - The interested parties involved in the court case.
 * @param {boolean} useNavrhovatel - Whether to use "navrhovatel" instead of "žalobce".
 * @returns {string} - The role of the complainant(s) in the formatted text.
 */
function getComplainantRole(complainants, plaintiffs, defendants, interestedParties, useNavrhovatel) {
    const complainantNames = complainants.map(c => c.name);
    const plaintiffComplainants = plaintiffs.filter(p => complainantNames.includes(p.name));
    const defendantComplainants = defendants.filter(d => complainantNames.includes(d.name));
    const interestedPartyComplainants = interestedParties.filter(i => complainantNames.includes(i.name));

    const formatComplainants = (complainants, totalParties, singularForm, pluralForm) => {
        if (complainants.length === 0) return '';
        if (complainants.length === 1) return `${singularForm} ${complainants[0].label || ''}`.trim();
        if (complainants.length === totalParties) return `${pluralForm}`;
        return `${pluralForm} ${complainants.map(c => c.label || '').filter(Boolean).join(', ')}`.trim();
    };

    const singularPlaintiffRole = useNavrhovatel ? 'navrhovatele' : 'žalobce';
    const pluralPlaintiffRole = useNavrhovatel ? 'navrhovatelů' : 'žalobců';
    const singularDefendantRole = useNavrhovatel ? 'odpůrce' : 'žalovaného';
    const pluralDefendantRole = useNavrhovatel ? 'odpůrců' : 'žalovaných';

    let complainantRole = '';

    if (plaintiffComplainants.length > 0) {
        complainantRole = formatComplainants(plaintiffComplainants, plaintiffs.length, singularPlaintiffRole, pluralPlaintiffRole);
    } else if (defendantComplainants.length > 0) {
        complainantRole = formatComplainants(defendantComplainants, defendants.length, singularDefendantRole, pluralDefendantRole);
    } else if (interestedPartyComplainants.length > 0) {
        complainantRole = formatComplainants(interestedPartyComplainants, interestedParties.length, 'osoby zúčastněné na řízení', 'osob zúčastněných na řízení');
    }

    return complainantRole.trim();
}

/**
 * Format multiple parties information.
 * @param {array} parties - The parties involved in the court case.
 * @param {string} role - The role of the parties.
 * @returns {string} - The formatted parties information.
 */
function formatMultipleParties(parties, role) {
    const commonAttributes = getCommonAttributes(parties);
    let result = `${role}: `;
    parties.forEach((party, index) => {
        result += `${String.fromCharCode(97 + index)}) ${formatPersonText(party, commonAttributes)}`;
        if (index < parties.length - 1) {
            result += ', ';
        }
    });
    result += formatCommonAttributes(commonAttributes, parties.length);
    return result;
}

/**
 * Format a single party's information.
 * @param {object} party - The party involved in the court case.
 * @param {string} role - The role of the party.
 * @returns {string} - The formatted party information.
 */
function formatSingleParty(party, role) {
    return `${role}: ${formatPersonText(party)}`;
}

/**
 * Get common attributes shared by multiple parties.
 * @param {array} parties - The parties involved in the court case.
 * @returns {object} - An object containing common nationality and attorney.
 */
function getCommonAttributes(parties) {
    const commonNationality = parties.every(p => p.nationality === parties[0].nationality) ? parties[0].nationality : null;
    const commonAttorney = parties.every(p => p.attorney.firstName === parties[0].attorney.firstName && p.attorney.lastName === parties[0].attorney.lastName && p.attorney.firstName !== "") ? parties[0].attorney : null;
    return { commonNationality, commonAttorney };
}

/**
 * Format the common attributes shared by multiple parties.
 * @param {object} commonAttributes - The common attributes.
 * @param {number} partyCount - The number of parties.
 * @returns {string} - The formatted common attributes information.
 */
function formatCommonAttributes(commonAttributes, partyCount) {
    let result = '';
    if (commonAttributes.commonNationality && commonAttributes.commonNationality !== "Česká republika") {
        result += `, ${partyCount === 2 ? 'oba' : 'všichni'} státní příslušnost ${commonAttributes.commonNationality}`;
    }
    if (commonAttributes.commonAttorney && commonAttributes.commonAttorney.firstName !== "") {
        result += `, ${partyCount === 2 ? 'oba' : 'všichni'} zast. ${formatAttorneyText(commonAttributes.commonAttorney)}`;
    }
    return result;
}

/**
 * Format multiple defendant decisions information.
 * @param {array} defendantDecisions - The decisions made by the defendants.
 * @param {array} defendants - The defendants involved in the court case.
 * @param {string} prefixFormat - The prefix format to use (e.g., "č. j." or "čj.").
 * @returns {string} - The formatted defendant decisions information.
 */
function formatMultipleDefendantDecisions(defendantDecisions, defendants, prefixFormat) {
    const decisionsByDefendants = groupDecisionsByDefendant(defendantDecisions, defendants);
    let result = `, proti rozhodnutím`;
    decisionsByDefendants.forEach((decisionGroup, index) => {
        result += formatDefendantDecisionGroup(decisionGroup, prefixFormat);
        if (index < decisionsByDefendants.length - 1) {
            result += ', a';
        }
    });
    return result + ',';
}

/**
 * Format a group of defendant decisions.
 * @param {object} decisionGroup - The group of decisions made by a defendant.
 * @param {string} prefixFormat - The prefix format to use (e.g., "č. j." or "čj.").
 * @returns {string} - The formatted group of defendant decisions information.
 */
function formatDefendantDecisionGroup(decisionGroup, prefixFormat) {
    const defendantLabel = `žalovaného ${decisionGroup.defendant.label}`;
    const decisions = decisionGroup.decisions.map((decision, index, array) => {
        const caseNumberPart = decision.caseNumber !== "nevyplněno" ? `sp. zn. ${decision.caseNumber}, ` : "";
        if (index === array.length - 1 && array.length > 1) {
            return `a ze dne ${decision.date}, ${caseNumberPart}${prefixFormat} ${decision.ref}`;
        }
        return `ze dne ${decision.date}, ${caseNumberPart}${prefixFormat} ${decision.ref}`;
    }).join(', ');
    return ` ${defendantLabel} ${decisions}`;
}

/**
 * Extract the court decision details.
 * @returns {object} - The court decision details.
 */
function extractCourtDecision() {
    const lowerCourtDecisionRow = document.querySelector('#ctl00_PlaceHolderMain_ctl00_tabMain_TabSpravni_po10_grdSoudniVykonRizeni1Stupne .ms-vb2');
    const lowerCourtDecisionRef = lowerCourtDecisionRow.querySelector('td:nth-child(1) a').innerText.trim();
    let lowerCourtName = lowerCourtDecisionRow.querySelector('td:nth-child(2)').innerText.trim();
    const lowerCourtDecisionDate = formatDate(lowerCourtDecisionRow.querySelector('td:nth-child(4)').innerText.trim());
    let lowerCourtDecisionForm = lowerCourtDecisionRow.querySelector('td:nth-child(7)').innerText.trim().toLowerCase();

    // Modify the decision form if it is "Rozsudek"
    if (lowerCourtDecisionForm === "rozsudek") {
        lowerCourtDecisionForm = "rozsudku";
    }

    // Modify the court name based on specific conditions
    if (lowerCourtName.includes("Krajský")) {
        lowerCourtName = lowerCourtName.replace("Krajský", "Krajského");
    } else if (lowerCourtName.includes("Městský")) {
        lowerCourtName = lowerCourtName.replace("Městský", "Městského");
    } else if (lowerCourtName.includes("Okresní")) {
        lowerCourtName = lowerCourtName.replace("Okresní", "Okresního");
    }

    // Ensure "soud" is replaced in all cases where it appears
    if (lowerCourtName.includes(" soud ")) {
        lowerCourtName = lowerCourtName.replace(" soud ", " soudu ");
    }

    return { lowerCourtDecisionRef, lowerCourtName, lowerCourtDecisionDate, lowerCourtDecisionForm };
}

/**
 * Group defendant decisions by defendant.
 * @param {array} defendantDecisions - The decisions made by the defendants.
 * @param {array} defendants - The defendants involved in the court case.
 * @returns {array} - An array of grouped decisions by defendant.
 */
function groupDecisionsByDefendant(defendantDecisions, defendants) {
    return defendants.map(defendant => ({
        defendant,
        decisions: defendantDecisions.filter(decision => decision.defendant === defendant.name)
    }));
}

/**
 * Extract persons involved in the court case based on their role.
 * @param {string} role - The role of the persons to extract.
 * @returns {array} - An array of extracted persons.
 */
async function extractPersons(role) {
    const persons = [];
    const personRows = document.querySelectorAll('#ctl00_PlaceHolderMain_ctl00_tabMain_TabPanel3_po8_grdSVRoleVeSporu .ms-vb2');
    for (const row of personRows) {
        const roleCell = row.querySelector('td:nth-child(2)');
        if (roleCell && roleCell.innerText.trim() === role) {
            const personDetails = await extractPersonDetails(row);
            if (personDetails) persons.push(personDetails);
        }
    }
    return persons;
}

/**
 * Extract details of a person involved in the court case.
 * @param {object} row - The row element containing the person's details.
 * @returns {object|null} - The extracted person details or null if extraction fails.
 */
async function extractPersonDetails(row) {
    const label = formatPersonLabel(row);
    const link = row.querySelector('td:nth-child(3) a').getAttribute('href');
    if (!link) return null;

    const cls = new URLSearchParams(link.split('?')[1]).get('cls');
    const pId = new URLSearchParams(link.split('?')[1]).get('pId');
    const personDetails = await fetchPersonDetails(cls, pId);
    const attorney = await fetchAttorney(pId);
    return { label, type: cls === 'JRFyzickaOsobaInfo' ? 'physical' : 'legal', ...personDetails, attorney };
}

/**
 * Format the label of a person.
 * @param {object} row - The row element containing the person's details.
 * @returns {string} - The formatted person label.
 */
function formatPersonLabel(row) {
    let label = row.querySelector('td:nth-child(1)').innerText.trim();
    if (label && !label.endsWith(')')) {
        label += ')';
    }
    return label;
}

/**
 * Fetch details of a person from the server.
 * @param {string} cls - The class of the person (e.g., "JRFyzickaOsobaInfo").
 * @param {string} pId - The person ID.
 * @returns {object} - The fetched person details.
 */
async function fetchPersonDetails(cls, pId) {
    const response = await fetch(`http://isnss/main.aspx?cls=${cls}&pId=${pId}`);
    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return cls === 'JRFyzickaOsobaInfo' ? fetchPhysicalPersonDetails(doc) : fetchLegalPersonDetails(doc);
}

/**
 * Fetch details of a physical person from the document.
 * @param {Document} doc - The document containing the person's details.
 * @returns {object} - The fetched physical person details.
 */
function fetchPhysicalPersonDetails(doc) {
    const firstName = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblJmeno');
    const lastName = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblPrijmeni');
    const birthdate = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblDatumNarozeni');
    const formattedBirthdate = birthdate ? formatDate(birthdate) : null;
    const nationality = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblStatPrislusnost');
    const address = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblAdresa');
    const titlesBefore = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblTitulPred');
    const titlesAfter = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblTitulZa');
    return { firstName, lastName, formattedBirthdate, nationality, address, titlesBefore, titlesAfter };
}

/**
 * Fetch details of a legal person from the document.
 * @param {Document} doc - The document containing the person's details.
 * @returns {object} - The fetched legal person details.
 */
function fetchLegalPersonDetails(doc) {
    const name = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabPO_po1_frmPO_lblNazev');
    const address = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabPO_po1_frmPO_lblAdresa');
    const registrationState = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabPO_po1_frmPO_lblStatReg');
    return { name, address, registrationState };
}

/**
 * Get the text content of an element selected by a CSS selector.
 * @param {Document} doc - The document containing the element.
 * @param {string} selector - The CSS selector of the element.
 * @returns {string} - The text content of the element.
 */
function getTextContent(doc, selector) {
    const element = doc.querySelector(selector);
    return element ? element.innerText.trim() : '';
}

/**
 * Fetch the attorney details of a person.
 * @param {string} pId - The person ID.
 * @returns {object} - The fetched attorney details.
 */
async function fetchAttorney(pId) {
    const attorneyRows = document.querySelectorAll('#ctl00_PlaceHolderMain_ctl00_tabMain_TabPanel3_po8_grdSVRolekUcastnikoviVeSporu .ms-vb2');
    for (const row of attorneyRows) {
        if (isMatchingAttorney(row, pId)) {
            const attorneyLink = row.querySelector('td:nth-child(4) a').getAttribute('href');
            const attorneyId = new URLSearchParams(attorneyLink.split('?')[1]).get('pId');
            return await fetchPersonDetails('JRFyzickaOsobaInfo', attorneyId);
        }
    }
    return { firstName: "", lastName: "", address: "", titlesBefore: "", titlesAfter: "" };
}

/**
 * Check if the row contains an attorney matching the person ID.
 * @param {object} row - The row element containing the attorney's details.
 * @param {string} pId - The person ID.
 * @returns {boolean} - Whether the row contains a matching attorney.
 */
function isMatchingAttorney(row, pId) {
    const subjectLink = row.querySelector('td:nth-child(1) a').getAttribute('href');
    const subjectId = new URLSearchParams(subjectLink.split('?')[1]).get('pId');
    return subjectId === pId;
}

/**
 * Format the text of a person.
 * @param {object} person - The person details.
 * @param {object} commonAttributes - Common attributes shared by multiple parties.
 * @returns {string} - The formatted person text.
 */
function formatPersonText(person, commonAttributes = {}) {
    const { commonNationality, commonAttorney } = commonAttributes;
    let text = '';
    if (person.type === 'physical') {
        text += formatPhysicalPersonText(person, commonNationality, commonAttorney);
    } else {
        text += formatLegalPersonText(person, commonNationality, commonAttorney);
    }
    return text;
}

/**
 * Format the text of a physical person.
 * @param {object} person - The physical person details.
 * @param {string|null} commonNationality - The common nationality shared by multiple parties.
 * @param {object|null} commonAttorney - The common attorney shared by multiple parties.
 * @returns {string} - The formatted physical person text.
 */
function formatPhysicalPersonText(person, commonNationality, commonAttorney) {
    let text = person.titlesBefore ? `${person.titlesBefore} ` : '';
    text += `${person.firstName} ${person.lastName}`;
    text += person.titlesAfter ? `, ${person.titlesAfter}` : '';
    const age = person.formattedBirthdate ? calculateAge(person.formattedBirthdate) : null;
    if ((age !== null && age < 18) || (person.nationality && person.nationality !== 'Česká republika')) {
        if (person.formattedBirthdate) {
            text += `, nar. ${person.formattedBirthdate}`;
        }
    }
    if (person.nationality && person.nationality !== 'Česká republika' && !commonNationality) {
        text += `, státní příslušnost ${person.nationality}`;
    }
    if (person.address && person.address !== 'adresa neznámá') {
        text += `, bytem ${person.address}`;
    }
    if (!commonAttorney && person.attorney.firstName) {
        text += `, zast. ${formatAttorneyText(person.attorney)}`;
    }
    return text;
}

/**
 * Format the text of a legal person.
 * @param {object} person - The legal person details.
 * @param {string|null} commonNationality - The common nationality shared by multiple parties.
 * @param {object|null} commonAttorney - The common attorney shared by multiple parties.
 * @returns {string} - The formatted legal person text.
 */
function formatLegalPersonText(person, commonNationality, commonAttorney) {
    let text = person.name;
    if (person.registrationState && person.registrationState !== 'Česká republika' && !commonNationality) {
        text += `, stát registrace ${person.registrationState}`;
    }
    if (person.address && person.address !== 'adresa neznámá') {
        text += `, se sídlem ${person.address}`;
    }
    if (!commonAttorney && person.attorney.firstName) {
        text += `, zast. ${formatAttorneyText(person.attorney)}`;
    }
    return text;
}

/**
 * Format the text of an attorney.
 * @param {object} attorney - The attorney details.
 * @returns {string} - The formatted attorney text.
 */
function formatAttorneyText(attorney) {
    return `${attorney.titlesBefore ? `${attorney.titlesBefore} ` : ''}${attorney.firstName} ${attorney.lastName}${attorney.titlesAfter ? `, ${attorney.titlesAfter}` : ''}, advokátem se sídlem ${attorney.address}`;
}

/**
 * Calculate the age of a person based on their birthdate.
 * @param {string} birthdate - The birthdate in the format "dd.mm.yyyy".
 * @returns {number|null} - The calculated age or null if the birthdate is invalid.
 */
function calculateAge(birthdate) {
    const [day, month, year] = birthdate.split('.').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const ageDiff = Date.now() - birthDate.getTime();
    return Math.abs(new Date(ageDiff).getUTCFullYear() - 1970);
}

/**
 * Format a date string from "dd.mm.yyyy" to a more readable format.
 * @param {string} dateString - The date string in the format "dd.mm.yyyy".
 * @returns {string} - The formatted date string.
 */
function formatDate(dateString) {
    const [day, month, year] = dateString.split('.');
    return `${parseInt(day)}. ${parseInt(month)}. ${year}`;
}

/**
 * Extract the defendant decisions from the court case.
 * @returns {array} - An array of defendant decisions.
 */
function extractDefendantDecisions() {
    const decisions = [];
    document.querySelectorAll('#ctl00_PlaceHolderMain_ctl00_tabMain_TabSpravni_po3_grdSoudniVykonSpravniOrgan .ms-vb2').forEach(row => {
        const caseNumber = row.querySelector('td:nth-child(1) a').innerText.trim();
        const ref = row.querySelector('td:nth-child(2)').innerText.trim();
        const date = formatDate(row.querySelector('td:nth-child(4)').innerText.trim());
        const defendant = row.querySelector('td:nth-child(3)').innerText.trim();
        decisions.push({ date, ref, defendant, caseNumber });
    });
    return decisions;
}

/**
 * Fallback method to copy text to clipboard if the Clipboard API is not available.
 * @param {string} text - The text to copy to clipboard.
 * @param {function} sendResponse - The function to send the response.
 */
function fallbackCopyTextToClipboard(text, sendResponse) {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
        document.execCommand("copy");
        sendResponse({ success: true, text: text });
    } catch (err) {
        console.error("ExecCommand error:", err);
        sendResponse({ success: false, error: err.toString() });
    } finally {
        document.body.removeChild(tempTextArea);
    }
}

// Event Listener for Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "extractInfo") {
        console.log("Received message:", message); // Debug log

        const includeVRizeni = message.includeVRizeni;
        const prefixFormat = message.prefixFormat;
        const useNavrhovatel = message.useNavrhovatel === "true"; // Convert string to boolean

        extractInformation(includeVRizeni, prefixFormat, useNavrhovatel).then(info => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(info).then(() => {
                    sendResponse({ success: true, text: info });
                }).catch(err => {
                    console.error("Error writing to clipboard:", err);
                    fallbackCopyTextToClipboard(info, sendResponse);
                });
            } else {
                fallbackCopyTextToClipboard(info, sendResponse);
            }
        }).catch(err => {
            console.error("Error extracting information:", err);
            sendResponse({ success: false, error: err.toString() });
        });

        return true; // Keeps the messaging channel open for sendResponse
    }
});
