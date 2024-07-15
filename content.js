/**
 * The main part of the ISNSS Extractor.
 * 
 * Author: Oldřich Tristan Florian
 * Website: https://otristan.com
 * 
 */

console.log("content.js loaded");

// Declare inflectText as a global variable only if not already declared
if (typeof inflectText === 'undefined') {
    var inflectText;
}

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
        if (decision.ref.includes("zásah")) {
            return `, o žalobě na ochranu před nezákonným zásahem žalovaného${defendants.length > 1 ? ` ${defendant.label}` : ''},`;
        } else if (decision.ref.includes("nečin")) {
            return `, ve věci ochrany proti nečinnosti žalovaného${defendants.length > 1 ? ` ${defendant.label}` : ''},`;
        } else {
            return `, proti rozhodnutí žalovaného${defendants.length > 1 ? ` ${defendant.label}` : ''} ze dne ${decision.date}, ${caseNumberPart}${prefixFormat} ${decision.ref},`;
        }
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
    const predicate = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblPridomek');
    if (firstName === '' && lastName === '' && predicate !== '') {
        return fetchOnePersonAuthorityDetails(doc);
    }
    const birthdate = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblDatumNarozeni');
    const formattedBirthdate = birthdate ? formatDate(birthdate) : null;
    const nationality = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblStatPrislusnost');
    const address = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblAdresa');
    const titlesBefore = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblTitulPred');
    const titlesAfter = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblTitulZa');
    const finalType = 'physical';
    return { firstName, lastName, formattedBirthdate, nationality, address, titlesBefore, titlesAfter, finalType };
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
    const finalType = 'legal';
    return { name, address, registrationState, finalType };
}

/**
 * Fetch details of a one-person authority from the document.
 * @param {Document} doc - The document containing the authority's details.
 * @returns {object} - The fetched authority details.
 */
function fetchOnePersonAuthorityDetails(doc) {
    const name = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblPridomek');
    const address = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblAdresa');
    const registrationState = getTextContent(doc, '#ctl00_PlaceHolderMain_ctl00_tabMain_tabFO_fo1_frmFO_lblStatPrislusnost');
    const finalType = 'onepersonauthority';
    return { name, address, registrationState, finalType };
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
    if (person.finalType === 'physical') {
        text += formatPhysicalPersonText(person, commonNationality, commonAttorney);
    } else if (person.finalType === 'legal') {
        text += formatLegalPersonText(person, commonNationality, commonAttorney);
    } else if (person.finalType === 'onepersonauthority') {
        text += formatOnePersonAuthorityText(person, commonNationality, commonAttorney);
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
 * Format the text of a one-person authority person.
 * @param {object} person - The one-person authority details.
 * @param {object|null} commonAttorney - The common attorney shared by multiple parties.
 * @returns {string} - The formatted one-person authority text.
 */
function formatOnePersonAuthorityText(person, commonAttorney) {
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
    let firstName = attorney.firstName;
    let lastName = attorney.lastName;

    if (inflectText) {
        if (typeof Inflection !== 'undefined') {
            const inflector = new Inflection();
            const inflectedFirstName = inflector.inflect(firstName);
            const inflectedLastName = inflector.inflect(lastName);

            // Use the 7th form (instrumental case) from the inflection result
            firstName = inflectedFirstName[7];
            lastName = inflectedLastName[7];
        } else {
            console.error("Inflection is not defined");
        }
    }

    return `${attorney.titlesBefore ? `${attorney.titlesBefore} ` : ''}${firstName} ${lastName}${attorney.titlesAfter ? `, ${attorney.titlesAfter}` : ''}, advokátem se sídlem ${attorney.address}`;
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
        inflectText = message.inflectText; // Assign the value of the inflection setting to the global variable

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


/* ...END OF THE MAIN SCRIPT... */

/**
 * JavaScript Library for Grammar Inflection
 * 
 * This library is a complete rework of the original PHP library licensed under the GNU Lesser General Public License (LGPL).
 * 
 * Patterns and algorithms for inflection are based on the work of Pavel Sedlák and Mikuláš Dítě, but all code is independently written for JavaScript.
 * 
 * Original Authors:
 * Pavel Sedlák 2009-2013 (patterns)
 * Mikuláš Dítě 2014 (algorithm)
 * 
 * JavaScript Rework by:
 * Oldřich Tristan Florian
 * Website: https://otristan.com
 * 
 */
class Inflection {
    constructor() {
        this.replacements = [];
        
        this.patterns = [
            ["m", "-ký", "kého", "kému", "ký/kého", "ký", "kém", "kým", "ké/cí", "kých", "kým", "ké", "ké/cí", "kých", "kými"],
            ["m", "-rý", "rého", "rému", "rý/rého", "rý", "rém", "rým", "ré/ří", "rých", "rým", "ré", "ré/ří", "rých", "rými"],
            ["m", "-chý", "chého", "chému", "chý/chého", "chý", "chém", "chým", "ché/ší", "chých", "chým", "ché", "ché/ší", "chých", "chými"],
            ["m", "-hý", "hého", "hému", "hý/hého", "hý", "hém", "hým", "hé/zí", "hých", "hým", "hé", "hé/zí", "hých", "hými"],
            ["m", "-ý", "ého", "ému", "ý/ého", "ý", "ém", "ým", "é/í", "ých", "ým", "é", "é/í", "ých", "ými"],
            ["m", "-([aeěií])cí", "0cího", "0címu", "0cí/0cího", "0cí", "0cím", "0cím", "0cí", "0cích", "0cím", "0cí", "0cí", "0cích", "0cími"],
            ["f", "-([aeěií])cí", "0cí", "0cí", "0cí", "0cí", "0cí", "0cí", "0cí", "0cích", "0cím", "0cí", "0cí", "0cích", "0cími"],
            ["s", "-([aeěií])cí", "0cího", "0címu", "0cí/0cího", "0cí", "0cím", "0cím", "0cí", "0cích", "0cím", "0cí", "0cí", "0cích", "0cími"],
            ["m", "-([bcčdhklmnprsštvzž])ní", "0ního", "0nímu", "0ní/0ního", "0ní", "0ním", "0ním", "0ní", "0ních", "0ním", "0ní", "0ní", "0ních", "0ními"],
            ["f", "-([bcčdhklmnprsštvzž])ní", "0ní", "0ní", "0ní", "0ní", "0ní", "0ní", "0ní", "0ních", "0ním", "0ní", "0ní", "0ních", "0ními"],
            ["s", "-([bcčdhklmnprsštvzž])ní", "0ního", "0nímu", "0ní/0ního", "0ní", "0ním", "0ním", "0ní", "0ních", "0ním", "0ní", "0ní", "0ních", "0ními"],
            ["m", "-([i])tel", "0tele", "0teli", "0tele", "0teli", "0teli", "0telem", "0telé", "0telů", "0telům", "0tele", "0telé", "0telích", "0teli"],
            ["m", "-([í])tel", "0tele", "0teli", "0tele", "0teli", "0teli", "0telem", "átelé", "átel", "átelům", "átele", "átelé", "átelích", "áteli"],
            ["m", "-([c])el", "0ela", "0elovi", "0ela", "0eli", "0elovi", "0elem", "celové", "celů", "celům", "cely", "celové", "celích", "cely"],
            ["m", "-([i])el", "0ela", "0elovi", "0ela", "0eli", "0elovi", "0elem", "ielové", "ielů", "ielům", "iely", "ielové", "ielích", "iely"],
            ["m", "-([o])is", "0ise", "0isovi", "0ise", "0isi", "0isovi", "0isem", "isové", "isů", "isům", "isovy", "isové", "isích", "isi"],
            ["m", "-([o])děk", "0ďka", "0ďkovi", "0ďka", "0ďku", "0ďkovi", "0ďkem", "ďkové", "ďků", "ďkům", "ďky", "ďkové", "ďcích", "ďky"],
            ["s", "-é", "ého", "ému", "é", "é", "ém", "ým", "á", "ých", "ým", "á", "á", "ých", "ými"],
            ["f", "-á", "é", "é", "ou", "á", "é", "ou", "é", "ých", "ým", "é", "é", "ých", "ými"],
            ["-", "já", "mne", "mně", "mne/mě", "já", "mně", "mnou", "my", "nás", "nám", "nás", "my", "nás", "námi"],
            ["-", "ty", "tebe", "tobě", "tě/tebe", "ty", "tobě", "tebou", "vy", "vás", "vám", "vás", "vy", "vás", "vámi"],
            ["-", "my", "", "", "", "", "", "", "my", "nás", "nám", "nás", "my", "nás", "námi"],
            ["-", "vy", "", "", "", "", "", "", "vy", "vás", "vám", "vás", "vy", "vás", "vámi"],
            ["m", "on", "něho", "mu/jemu/němu", "ho/jej", "on", "něm", "ním", "oni", "nich", "nim", "je", "oni", "nich", "jimi/nimi"],
            ["m", "oni", "", "", "", "", "", "", "oni", "nich", "nim", "je", "oni", "nich", "jimi/nimi"],
            ["f", "ony", "", "", "", "", "", "", "ony", "nich", "nim", "je", "ony", "nich", "jimi/nimi"],
            ["s", "ono", "něho", "mu/jemu/němu", "ho/jej", "ono", "něm", "ním", "ona", "nich", "nim", "je", "ony", "nich", "jimi/nimi"],
            ["f", "ona", "ní", "ní", "ji", "ona", "ní", "ní", "ony", "nich", "nim", "je", "ony", "nich", "jimi/nimi"],
            ["m", "ten", "toho", "tomu", "toho", "ten", "tom", "tím", "ti", "těch", "těm", "ty", "ti", "těch", "těmi"],
            ["f", "ta", "té", "té", "tu", "ta", "té", "tou", "ty", "těch", "těm", "ty", "ty", "těch", "těmi"],
            ["s", "to", "toho", "tomu", "toho", "to", "tom", "tím", "ta", "těch", "těm", "ta", "ta", "těch", "těmi"],

            ["m", "můj", "mého", "mému", "mého", "můj", "mém", "mým", "mí", "mých", "mým", "mé", "mí", "mých", "mými"],
            ["f", "má", "mé", "mé", "mou", "má", "mé", "mou", "mé", "mých", "mým", "mé", "mé", "mých", "mými"],
            ["f", "moje", "mé", "mé", "mou", "má", "mé", "mou", "moje", "mých", "mým", "mé", "mé", "mých", "mými"],
            ["s", "mé", "mého", "mému", "mé", "moje", "mém", "mým", "mé", "mých", "mým", "má", "má", "mých", "mými"],
            ["s", "moje", "mého", "mému", "moje", "moje", "mém", "mým", "moje", "mých", "mým", "má", "má", "mých", "mými"],

            ["m", "tvůj", "tvého", "tvému", "tvého", "tvůj", "tvém", "tvým", "tví", "tvých", "tvým", "tvé", "tví", "tvých", "tvými"],
            ["f", "tvá", "tvé", "tvé", "tvou", "tvá", "tvé", "tvou", "tvé", "tvých", "tvým", "tvé", "tvé", "tvých", "tvými"],
            ["f", "tvoje", "tvé", "tvé", "tvou", "tvá", "tvé", "tvou", "tvé", "tvých", "tvým", "tvé", "tvé", "tvých", "tvými"],
            ["s", "tvé", "tvého", "tvému", "tvého", "tvůj", "tvém", "tvým", "tvá", "tvých", "tvým", "tvé", "tvá", "tvých", "tvými"],
            ["s", "tvoje", "tvého", "tvému", "tvého", "tvůj", "tvém", "tvým", "tvá", "tvých", "tvým", "tvé", "tvá", "tvých", "tvými"],

            ["m", "náš", "našeho", "našemu", "našeho", "náš", "našem", "našim", "naši", "našich", "našim", "naše", "naši", "našich", "našimi"],
            ["f", "naše", "naší", "naší", "naši", "naše", "naší", "naší", "naše", "našich", "našim", "naše", "naše", "našich", "našimi"],
            ["s", "naše", "našeho", "našemu", "našeho", "naše", "našem", "našim", "naše", "našich", "našim", "naše", "naše", "našich", "našimi"],

            ["m", "váš", "vašeho", "vašemu", "vašeho", "váš", "vašem", "vašim", "vaši", "vašich", "vašim", "vaše", "vaši", "vašich", "vašimi"],
            ["f", "vaše", "vaší", "vaší", "vaši", "vaše", "vaší", "vaší", "vaše", "vašich", "vašim", "vaše", "vaše", "vašich", "vašimi"],
            ["s", "vaše", "vašeho", "vašemu", "vašeho", "vaše", "vašem", "vašim", "vaše", "vašich", "vašim", "vaše", "vaše", "vašich", "vašimi"],

            ["m", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho"],
            ["f", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho"],
            ["s", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho", "jeho"],

            ["m", "její", "jejího", "jejímu", "jejího", "její", "jejím", "jejím", "její", "jejích", "jejím", "její", "její", "jejích", "jejími"],
            ["s", "její", "jejího", "jejímu", "jejího", "její", "jejím", "jejím", "její", "jejích", "jejím", "její", "její", "jejích", "jejími"],
            ["f", "její", "její", "její", "její", "její", "její", "její", "její", "jejích", "jejím", "její", "její", "jejích", "jejími"],

            ["m", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich"],
            ["s", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich"],
            ["f", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich", "jejich"],

            ["m", "-bůh", "boha", "bohu", "boha", "bože", "bohovi", "bohem", "bozi/bohové", "bohů", "bohům", "bohy", "bozi/bohové", "bozích", "bohy"],
            ["m", "-pan", "pana", "panu", "pana", "pane", "panu", "panem", "páni/pánové", "pánů", "pánům", "pány", "páni/pánové", "pánech", "pány"],
            ["s", "moře", "moře", "moři", "moře", "moře", "moři", "mořem", "moře", "moří", "mořím", "moře", "moře", "mořích", "moři"],
            ["-", "dveře", "", "", "", "", "", "", "dveře", "dveří", "dveřím", "dveře", "dveře", "dveřích", "dveřmi"],
            ["-", "housle", "", "", "", "", "", "", "housle", "houslí", "houslím", "housle", "housle", "houslích", "houslemi"],
            ["-", "šle", "", "", "", "", "", "", "šle", "šlí", "šlím", "šle", "šle", "šlích", "šlemi"],
            ["-", "muka", "", "", "", "", "", "", "muka", "muk", "mukám", "muka", "muka", "mukách", "mukami"],
            ["s", "ovoce", "ovoce", "ovoci", "ovoce", "ovoce", "ovoci", "ovocem", "", "", "", "", "", "", ""],
            ["m", "humus", "humusu", "humusu", "humus", "humuse", "humusu", "humusem", "humusy", "humusů", "humusům", "humusy", "humusy", "humusech", "humusy"],
            ["m", "-vztek", "vzteku", "vzteku", "vztek", "vzteku", "vzteku", "vztekem", "vzteky", "vzteků", "vztekům", "vzteky", "vzteky", "vztecích", "vzteky"],
            ["m", "-dotek", "doteku", "doteku", "dotek", "doteku", "doteku", "dotekem", "doteky", "doteků", "dotekům", "doteky", "doteky", "dotecích", "doteky"],
            ["f", "-hra", "hry", "hře", "hru", "hro", "hře", "hrou", "hry", "her", "hrám", "hry", "hry", "hrách", "hrami"],
            ["m", "zeus", "dia", "diovi", "dia", "die", "diovi", "diem", "diové", "diů", "diům", "", "diové", "", ""],
            ["f", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol", "nikol"],

            ["-", "-tdva", "tidvou", "tidvoum", "tdva", "tdva", "tidvou", "tidvěmi", "", "", "", "", "", "", ""],
            ["-", "-tdvě", "tidvou", "tidvěma", "tdva", "tdva", "tidvou", "tidvěmi", "", "", "", "", "", "", ""],
            ["-", "-ttři", "titří", "titřem", "ttři", "ttři", "titřech", "titřemi", "", "", "", "", "", "", ""],
            ["-", "-tčtyři", "tičtyřech", "tičtyřem", "tčtyři", "tčtyři", "tičtyřech", "tičtyřmi", "", "", "", "", "", "", ""],
            ["-", "-tpět", "tipěti", "tipěti", "tpět", "tpět", "tipěti", "tipěti", "", "", "", "", "", "", ""],
            ["-", "-tšest", "tišesti", "tišesti", "tšest", "tšest", "tišesti", "tišesti", "", "", "", "", "", "", ""],
            ["-", "-tsedm", "tisedmi", "tisedmi", "tsedm", "tsedm", "tisedmi", "tisedmi", "", "", "", "", "", "", ""],
            ["-", "-tosm", "tiosmi", "tiosmi", "tosm", "tosm", "tiosmi", "tiosmi", "", "", "", "", "", "", ""],
            ["-", "-tdevět", "tidevíti", "tidevíti", "tdevět", "tdevět", "tidevíti", "tidevíti", "", "", "", "", "", "", ""],

            ["f", "-jedna", "jedné", "jedné", "jednu", "jedno", "jedné", "jednou", "", "", "", "", "", "", ""],
            ["m", "-jeden", "jednoho", "jednomu", "jednoho", "jeden", "jednom", "jedním", "", "", "", "", "", "", ""],
            ["s", "-jedno", "jednoho", "jednomu", "jednoho", "jedno", "jednom", "jedním", "", "", "", "", "", "", ""],
            ["-", "-dva", "dvou", "dvoum", "dva", "dva", "dvou", "dvěmi", "", "", "", "", "", "", ""],
            ["-", "-dvě", "dvou", "dvoum", "dva", "dva", "dvou", "dvěmi", "", "", "", "", "", "", ""],
            ["-", "-tři", "tří", "třem", "tři", "tři", "třech", "třemi", "", "", "", "", "", "", ""],
            ["-", "-čtyři", "čtyřech", "čtyřem", "čtyři", "čtyři", "čtyřech", "čtyřmi", "", "", "", "", "", "", ""],
            ["-", "-pět", "pěti", "pěti", "pět", "pět", "pěti", "pěti", "", "", "", "", "", "", ""],
            ["-", "-šest", "šesti", "šesti", "šest", "šest", "šesti", "šesti", "", "", "", "", "", "", ""],
            ["-", "-sedm", "sedmi", "sedmi", "sedm", "sedm", "sedmi", "sedmi", "", "", "", "", "", "", ""],
            ["-", "-osm", "osmi", "osmi", "osm", "osm", "osmi", "osmi", "", "", "", "", "", "", ""],
            ["-", "-devět", "devíti", "devíti", "devět", "devět", "devíti", "devíti", "", "", "", "", "", "", ""],

            ["-", "deset", "deseti", "deseti", "deset", "deset", "deseti", "deseti", "", "", "", "", "", "", ""],

            ["-", "-ná([cs])t", "ná0ti", "ná0ti", "ná0t", "náct", "ná0ti", "ná0ti", "", "", "", "", "", "", ""],

            ["-", "-dvacet", "dvaceti", "dvaceti", "dvacet", "dvacet", "dvaceti", "dvaceti", "", "", "", "", "", "", ""],
            ["-", "-třicet", "třiceti", "třiceti", "třicet", "třicet", "třiceti", "třiceti", "", "", "", "", "", "", ""],
            ["-", "-čtyřicet", "čtyřiceti", "čtyřiceti", "čtyřicet", "čtyřicet", "čtyřiceti", "čtyřiceti", "", "", "", "", "", "", ""],
            ["-", "-desát", "desáti", "desáti", "desát", "desát", "desáti", "desáti", "", "", "", "", "", "", ""],

            ["m", "-([i])sta", "0sty", "0stovi", "0stu", "0sto", "0stovi", "0stou", "0sté", "0stů", "0stům", "0sty", "0sté", "0stech", "0sty"],
            ["m", "-([o])sta", "0sty", "0stovi", "0stu", "0sto", "0stovi", "0stou", "0stové", "0stů", "0stům", "0sty", "0sté", "0stech", "0sty"],

            ["m", "-předseda", "předsedy", "předsedovi", "předsedu", "předsedo", "předsedovi", "předsedou", "předsedové", "předsedů", "předsedům", "předsedy", "předsedové", "předsedech", "předsedy"],
            ["m", "-srdce", "srdce", "srdi", "sdrce", "srdce", "srdci", "srdcem", "srdce", "srdcí", "srdcím", "srdce", "srdce", "srdcích", "srdcemi"],

            ["m", "-([db])ce", "0ce", "0ci", "0ce", "0če", "0ci", "0cem", "0ci/0cové", "0ců", "0cům", "0ce", "0ci/0cové", "0cích", "0ci"],
            ["m", "-([jň])ev", "0evu", "0evu", "0ev", "0eve", "0evu", "0evem", "0evy", "0evů", "0evům", "0evy", "0evy", "0evech", "0evy"],
            ["m", "-([lř])ev", "0evu/0va", "0evu/0vovi", "0ev/0va", "0eve/0ve", "0evu/0vovi", "0evem/0vem", "0evy/0vové", "0evů/0vů", "0evům/0vům", "0evy/0vy", "0evy/0vové", "0evech/0vech", "0evy/0vy"],
            ["m", "-ů([lz])", "o0u/o0a", "o0u/o0ovi", "ů0/o0a", "o0e", "o0u", "o0em", "o0y/o0ové", "o0ů", "o0ům", "o0y", "o0y/o0ové", "o0ech", "o0y"],

            ["m", "nůž", "nože", "noži", "nůž", "noži", "noži", "nožem", "nože", "nožů", "nožům", "nože", "nože", "nožích", "noži"],

            ["s", "-([bcčdghksštvzž])lo", "0la", "0lu", "0lo", "0lo", "0lu", "0lem", "0la", "0el", "0lům", "0la", "0la", "0lech", "0ly"],
            ["s", "-([bcčdnsštvzž])ko", "0ka", "0ku", "0ko", "0ko", "0ku", "0kem", "0ka", "0ek", "0kům", "0ka", "0ka", "0cích/0kách", "0ky"],
            ["s", "-([bcčdksštvzž])no", "0na", "0nu", "0no", "0no", "0nu", "0nem", "0na", "0en", "0nům", "0na", "0na", "0nech/0nách", "0ny"],
            ["s", "-o", "a", "u", "o", "o", "u", "em", "a", "", "ům", "a", "a", "ech", "y"],
            ["s", "-í", "í", "í", "í", "í", "í", "ím", "í", "í", "ím", "í", "í", "ích", "ími"],
            ["s", "-([čďť])([e])", "10te", "10ti", "10", "10", "10ti", "10tem", "1ata", "1at", "1atům", "1ata", "1ata", "1atech", "1aty"],
            ["f", "-([aeiouyáéíóúý])ka", "0ky", "0ce", "0ku", "0ko", "0ce", "0kou", "0ky", "0k", "0kám", "0ky", "0ky", "0kách", "0kami"],
            ["f", "-ka", "ky", "ce", "ku", "ko", "ce", "kou", "ky", "ek", "kám", "ky", "ky", "kách", "kami"],
            ["f", "-([bdghkmnptvz])ra", "0ry", "0ře", "0ru", "0ro", "0ře", "0rou", "0ry", "0er", "0rám", "0ry", "0ry", "0rách", "0rami"],
            ["f", "-ra", "ry", "ře", "ru", "ro", "ře", "rou", "ry", "r", "rám", "ry", "ry", "rách", "rami"],
            ["f", "-([tdbnvmp])a", "0y", "0ě", "0u", "0o", "0ě", "0ou", "0y", "0", "0ám", "0y", "0y", "0ách", "0ami"],
            ["f", "-cha", "chy", "še", "chu", "cho", "še", "chou", "chy", "ch", "chám", "chy", "chy", "chách", "chami"],
            ["f", "-([gh])a", "0y", "ze", "0u", "0o", "ze", "0ou", "0y", "0", "0ám", "0y", "0y", "0ách", "0ami"],
            ["f", "-ňa", "ni", "ně", "ňou", "ňo", "ni", "ňou", "ně/ničky", "ň", "ňám", "ně/ničky", "ně/ničky", "ňách", "ňami"],
            ["f", "-([šč])a", "0i", "0e", "0u", "0o", "0e", "0ou", "0e/0i", "0", "0ám", "0e/0i", "0e/0i", "0ách", "0ami"],
            ["f", "-a", "y", "e", "u", "o", "e", "ou", "y", "", "ám", "y", "y", "ách", "ami"],
            ["f", "-eň", "ně", "ni", "eň", "ni", "ni", "ní", "ně", "ní", "ním", "ně", "ně", "ních", "němi"],
            ["f", "-oň", "oně", "oni", "oň", "oni", "oni", "oní", "oně", "oní", "oním", "oně", "oně", "oních", "oněmi"],
            ["f", "-([ě])j", "0je", "0ji", "0j", "0ji", "0ji", "0jí", "0je", "0jí", "0jím", "0je", "0je", "0jích", "0jemi"],
            ["f", "-ev", "ve", "vi", "ev", "vi", "vi", "ví", "ve", "ví", "vím", "ve", "ve", "vích", "vemi"],
            ["f", "-ice", "ice", "ici", "ici", "ice", "ici", "icí", "ice", "ic", "icím", "ice", "ice", "icích", "icemi"],
            ["f", "-e", "e", "i", "i", "e", "i", "í", "e", "í", "ím", "e", "e", "ích", "emi"],
            ["f", "-([eaá])([jžň])", "10e/10i", "10i", "10", "10i", "10i", "10í", "10e/10i", "10í", "10ím", "10e", "10e", "10ích", "10emi"],
            ["f", "-([eayo])([š])", "10e/10i", "10i", "10", "10i", "10i", "10í", "10e/10i", "10í", "10ím", "10e", "10e", "10ích", "10emi"],
            ["f", "-([íy])ň", "0ně", "0ni", "0ň", "0ni", "0ni", "0ní", "0ně", "0ní", "0ním", "0ně", "0ně", "0ních", "0němi"],

            ["f", "-([íyý])ňe", "0ně", "0ni", "0ň", "0ni", "0ni", "0ní", "0ně", "0ní", "0ním", "0ně", "0ně", "0ních", "0němi"],
            ["f", "-([ťďž])", "0e", "0i", "0", "0i", "0i", "0í", "0e", "0í", "0ím", "0e", "0e", "0ích", "0emi"],
            ["f", "-toř", "toře", "toři", "toř", "toři", "toři", "toří", "toře", "toří", "tořím", "toře", "toře", "tořích", "tořemi"],
            ["f", "-ep", "epi", "epi", "ep", "epi", "epi", "epí", "epi", "epí", "epím", "epi", "epi", "epích", "epmi"],

            ["f", "-st", "sti", "sti", "st", "sti", "sti", "stí", "sti", "stí", "stem", "sti", "sti", "stech", "stmi"],

            ["f", "ves", "vsi", "vsi", "ves", "vsi", "vsi", "vsí", "vsi", "vsí", "vsem", "vsi", "vsi", "vsech", "vsemi"],

            ["m", "-([e])us", "0a", "0u/0ovi", "0a", "0e", "0u/0ovi", "0em", "0ové", "0ů", "0ům", "0y", "0ové", "0ích", "0y"],
            ["m", "-([i])us", "0a", "0u/0ovi", "0a", "0e", "0u/0ovi", "0em", "0ové", "0ů", "0ům", "0usy", "0ové", "0ích", "0usy"],
            ["m", "-([i])s", "0se", "0su/0sovi", "0se", "0se/0si", "0su/0sovi", "0sem", "0sy/0sové", "0sů", "0sům", "0sy", "0sy/0ové", "0ech", "0sy"],

            ["m", "výtrus", "výtrusu", "výtrusu", "výtrus", "výtruse", "výtrusu", "výtrusem", "výtrusy", "výtrusů", "výtrusům", "výtrusy", "výtrusy", "výtrusech", "výtrusy"],
            ["m", "trus", "trusu", "trusu", "trus", "truse", "trusu", "trusem", "trusy", "trusů", "trusům", "trusy", "trusy", "trusech", "trusy"],

            ["m", "-([aeioumpts])([lnmrktp])us", "10u/10a", "10u/10ovi", "10us/10a", "10e", "10u/10ovi", "10em", "10y/10ové", "10ů", "10ům", "10y", "10y/10ové", "10ech", "10y"],
            ["s", "-([l])um", "0a", "0u", "0um", "0um", "0u", "0em", "0a", "0", "0ům", "0a", "0a", "0ech", "0y"],
            ["s", "-([k])um", "0a", "0u", "0um", "0um", "0u", "0em", "0a", "0", "0ům", "0a", "0a", "0cích", "0y"],
            ["s", "-([i])um", "0a", "0u", "0um", "0um", "0u", "0em", "0a", "0í", "0ům", "0a", "0a", "0iích", "0y"],
            ["s", "-io", "0a", "0u", "0", "0", "0u", "0em", "0a", "0í", "0ům", "0a", "0a", "0iích", "0y"],
            ["m", "-([aeiouyáéíóúý])r", "0ru/0ra", "0ru/0rovi", "0r/0ra", "0re", "0ru/0rovi", "0rem", "0ry/0rové", "0rů", "0rům", "0ry", "0ry/0rové", "0rech", "0ry"],
            ["m", "-r", "ru/ra", "ru/rovi", "r/ra", "ře", "ru/rovi", "rem", "ry/rové", "rů", "rům", "ry", "ry/rové", "rech", "ry"],
            ["m", "-([mnp])en", "0enu/0ena", "0enu/0enovi", "0en/0na", "0ene", "0enu/0enovi", "0enem", "0eny/0enové", "0enů", "0enům", "0eny", "0eny/0enové", "0enech", "0eny"],
            ["m", "-([bcčdstvz])en", "0nu/0na", "0nu/0novi", "0en/0na", "0ne", "0nu/0novi", "0nem", "0ny/0nové", "0nů", "0nům", "0ny", "0ny/0nové", "0nech", "0ny"],
            ["m", "-([dglmnpbtvzs])", "0u/0a", "0u/0ovi", "0/0a", "0e", "0u/0ovi", "0em", "0y/0ové", "0ů", "0ům", "0y", "0y/0ové", "0ech", "0y"],
            ["m", "-([x])", "0u/0e", "0u/0ovi", "0/0e", "0i", "0u/0ovi", "0em", "0y/0ové", "0ů", "0ům", "0y", "0y/0ové", "0ech", "0y"],

            ["m", "sek", "seku/seka", "seku/sekovi", "sek/seka", "seku", "seku/sekovi", "sekem", "seky/sekové", "seků", "sekům", "seky", "seky/sekové", "secích", "seky"],
            ["m", "výsek", "výseku/výseka", "výseku/výsekovi", "výsek/výseka", "výseku", "výseku/výsekovi", "výsekem", "výseky/výsekové", "výseků", "výsekům", "výseky", "výseky/výsekové", "výsecích", "výseky"],
            ["m", "zásek", "záseku/záseka", "záseku/zásekovi", "zásek/záseka", "záseku", "záseku/zásekovi", "zásekem", "záseky/zásekové", "záseků", "zásekům", "záseky", "záseky/zásekové", "zásecích", "záseky"],
            ["m", "průsek", "průseku/průseka", "průseku/průsekovi", "průsek/průseka", "průseku", "průseku/průsekovi", "průsekem", "průseky/průsekové", "průseků", "výsekům", "průseky", "průseky/průsekové", "průsecích", "průseky"],

            ["m", "-([cčšždnňmpbrstvz])ek", "0ku/0ka", "0ku/0kovi", "0ek/0ka", "0ku", "0ku/0kovi", "0kem", "0ky/0kové", "0ků", "0kům", "0ky", "0ky/0kové", "0cích", "0ky"],
            ["m", "-([k])", "0u/0a", "0u/0ovi", "0/0a", "0u", "0u/0ovi", "0em", "0y/0ové", "0ů", "0ům", "0y", "0y/0ové", "cích", "0y"],
            ["m", "-ch", "chu/cha", "chu/chovi", "ch/cha", "chu/cha", "chu/chovi", "chem", "chy/chové", "chů", "chům", "chy", "chy/chové", "ších", "chy"],
            ["m", "-([h])", "0u/0a", "0u/0ovi", "0/0a", "0u", "0u/0ovi", "0em", "0y/0ové", "0ů", "0ům", "0y", "0y/0ové", "zích", "0y"],
            ["m", "-e([mnz])", "0u/0a", "0u/0ovi", "e0/e0a", "0e", "0u/0ovi", "0em", "0y/0ové", "0ů", "0ům", "0y", "0y/0ové", "0ech", "0y"],
            ["m", "-ec", "ce", "ci/covi", "ec/ce", "če", "ci/covi", "cem", "ce/cové", "ců", "cům", "ce", "ce/cové", "cích", "ci"],
            ["m", "-([cčďšňřťž])", "0e", "0i/0ovi", "0e", "0i", "0i/0ovi", "0em", "0e/0ové", "0ů", "0ům", "0e", "0e/0ové", "0ích", "0i"],
            ["m", "-oj", "oje", "oji/ojovi", "oj/oje", "oji", "oji/ojovi", "ojem", "oje/ojové", "ojů", "ojům", "oje", "oje/ojové", "ojích", "oji"],
            ["m", "-([gh])a", "0y", "0ovi", "0u", "0o", "0ovi", "0ou", "0ové", "0ů", "0ům", "0y", "0ové", "zích", "0y"],
            ["m", "-([k])a", "0y", "0ovi", "0u", "0o", "0ovi", "0ou", "0ové", "0ů", "0ům", "0y", "0ové", "cích", "0y"],
            ["m", "-a", "y", "ovi", "u", "o", "ovi", "ou", "ové", "ů", "ům", "y", "ové", "ech", "y"],
            ["f", "-l", "le", "li", "l", "li", "li", "lí", "le", "lí", "lím", "le", "le", "lích", "lemi"],

            ["f", "-í", "í", "í", "í", "í", "í", "í", "í", "ích", "ím", "í", "í", "ích", "ími"],

            ["f", "-([jř])", "0e", "0i", "0", "0i", "0i", "0í", "0e", "0í", "0ím", "0e", "0e", "0ích", "0emi"],
            ["f", "-([č])", "0i", "0i", "0", "0i", "0i", "0í", "0i", "0í", "0ím", "0i", "0i", "0ích", "0mi"],
            ["f", "-([š])", "0i", "0i", "0", "0i", "0i", "0í", "0i", "0í", "0ím", "0i", "0i", "0ích", "0emi"],
            ["s", "-([sljřň])e", "0ete", "0eti", "0e", "0e", "0eti", "0etem", "0ata", "0at", "0atům", "0ata", "0ata", "0atech", "0aty"],
            ["m", "-j", "je", "ji", "j", "ji", "ji", "jem", "je/jové", "jů", "jům", "je", "je/jové", "jích", "ji"],
            ["m", "-f", "fa", "fu/fovi", "f/fa", "fe", "fu/fovi", "fem", "fy/fové", "fů", "fům", "fy", "fy/fové", "fech", "fy"],
            ["m", "-í", "ího", "ímu", "ího", "í", "ímu", "ím", "í", "ích", "ím", "í", "í", "ích", "ími"],
            ["m", "-go", "a", "govi", "ga", "ga", "govi", "gem", "gové", "gů", "gům", "gy", "gové", "zích", "gy"],
            ["m", "-o", "a", "ovi", "a", "o", "ovi", "em", "ové", "ů", "ům", "y", "ové", "ech", "y"],
            ["", "-([tp])y", "", "", "", "", "", "", "0y", "0", "0ům", "0y", "0y", "0ech", "0ami"],
            ["", "-([k])y", "", "", "", "", "", "", "0y", "e0", "0ám", "0y", "0y", "0ách", "0ami"],
            ["f", "-ar", "ary", "aře", "ar", "ar", "ar", "ar", "ary", "ar", "arám", "ary", "ary", "arách", "arami"],
            ["f", "-am", "am", "am", "am", "am", "am", "am", "am", "am", "am", "am", "am", "am", "am"],
            ["f", "-er", "er", "er", "er", "er", "er", "er", "ery", "er", "erám", "ery", "ery", "erách", "erami"],
            ["m", "-oe", "oema", "oemovi", "oema", "oeme", "emovi", "emem", "oemové", "oemů", "oemům", "oemy", "oemové", "oemech", "oemy"],
            ["f", "-a", "y", "ě", "u", "o", "ě", "ou", "y", "", "ám", "y", "y", "ách", "ami"],
        ];

        this.exceptions = [
            ["bořek", "bořk", "bořka"],
            ["bořek", "bořk", "bořka"],
            ["chleba", "chleb", "chleba"],
            ["chléb", "chleb", "chleba"],
            ["cyklus", "cykl", "cyklus"],
            ["dvůr", "dvor", "dvůr"],
            ["déšť", "dešť", "déšť"],
            ["důl", "dol", "důl"],
            ["havel", "havl", "havla"],
            ["hnůj", "hnoj", "hnůj"],
            ["hůl", "hole", "hůl"],
            ["karel", "karl", "karla"],
            ["kel", "kl", "kel"],
            ["kotel", "kotl", "kotel"],
            ["kůň", "koň", "koně"],
            ["luděk", "luďk", "luďka"],
            ["líh", "lih", "líh"],
            ["mráz", "mraz", "mráz"],
            ["myš", "myše", "myš"],
            ["nehet", "neht", "nehet"],
            ["ocet", "oct", "octa"],
            ["osel", "osl", "osla"],
            ["pavel", "pavl", "pavla"],
            ["pes", "ps", "psa"],
            ["peň", "pň", "peň"],
            ["posel", "posl", "posla"],
            ["prsten", "prstýnek", "prstýnku"],
            ["pytel", "pytl", "pytel"],
            ["půl", "půle", "půli"],
            ["skrýš", "skrýše", "skrýš"],
            ["smrt", "smrť", "smrt"],
            ["sníh", "sněh", "sníh"],
            ["sopel", "sopl", "sopel"],
            ["stupeň", "stupň", "stupeň"],
            ["stůl", "stol", "stůl"],
            ["svatozář", "svatozáře", "svatozář"],
            ["sůl", "sole", "sůl"],
            ["tůň", "tůňe", "tůň"],
            ["veš", "vš", "veš"],
            ["vítr", "větr", "vítr"],
            ["vůl", "vol", "vola"],
            ["zeď", "zď", "zeď"],
            ["zář", "záře", "zář"],
            ["účet", "účt", "účet"],
        ];

        this.forceM = [
            "alexej",
            "aleš",
            "alois",
            "ambrož",
            "ametyst",
            "andrej",
            "arest",
            "azbest",
            "bartoloměj",
            "bruno",
            "chlast",
            "chřest",
            "čaj",
            "čaroďej",
            "darmoďej",
            "dešť",
            "displej",
            "dobroďej",
            "drákula",
            "ďeda",
            "ďej",
            "host",
            "hranostaj",
            "hugo",
            "háj",
            "ilja",
            "ivo",
            "jirka",
            "jiří",
            "kolega",
            "koloďej",
            "komoří",
            "kontest",
            "koň",
            "kvido",
            "kříž",
            "lanýž",
            "lukáš",
            "maťej",
            "mikoláš",
            "mikuláš",
            "mluvka",
            "most",
            "motorest",
            "moula",
            "muž",
            "noe",
            "ondřej",
            "oto",
            "otto",
            "papež",
            "pepa",
            "peň",
            "plast",
            "podkoní",
            "polda",
            "prodej",
            "protest",
            "rest",
            "saša",
            "sleď",
            "slouha",
            "sluha",
            "sprej",
            "strejda",
            "stupeň",
            "sťežeň",
            "šmoula",
            "termoplast",
            "test",
            "tobiáš",
            "tomáš",
            "trest",
            "táta",
            "velmož",
            "výdej",
            "výprodej",
            "vězeň",
            "zeť",
            "zloďej",
            "žokej",
        ];

        this.forceF = [
            "dagmar",
            "dešť",
            "digestoř",
            "ester",
            "kancelář",
            "kleč",
            "konzervatoř",
            "koudel",
            "koupel",
            "křeč",
            "maštal",
            "miriam",
            "neteř",
            "obec",
            "ocel",
            "oratoř",
            "otep",
            "postel",
            "prdel",
            "rozkoš",
            "řeč",
            "sbeř",
            "trofej",
            "ves",
            "výstroj",
            "výzbroj",
            "vš",
            "zbroj",
            "zteč",
            "zvěř",
            "závěj",
        ];

        this.forceS = [
            "house",
            "kuře",
            "kůzle",
            "nemluvňe",
            "osle",
            "prase",
            "sele",
            "slůně",
            "tele",
            "vejce",
            "zvíře",
        ];
    }

    inflect(text, animate = false) {
        let words = text.split(' ').reverse();
        let gender = null;
        let inflected = [];

        for (let word of words) {
            let isUpper = word[0] === word[0].toUpperCase();
            let inflectedWord = { 1: word };
            word = this.breakAccents(word);
            let wordLower = word.toLowerCase();

            if (gender === null) {
                if (this.forceM.includes(wordLower)) gender = 'm';
                else if (this.forceF.includes(wordLower)) gender = 'f';
                else if (this.forceS.includes(wordLower)) gender = 's';
            }

            let exception = this.exceptions.find(e => e[0] === this.breakAccents(wordLower));

            for (let pattern of this.patterns) {
                if (gender && pattern[0] !== gender) continue;

                let baseWord = exception ? exception[1] : word;
                let left = this.match(pattern[1], baseWord);

                if (left !== -1) {
                    let prefix = baseWord.slice(0, left);
                    for (let caseIndex = 2; caseIndex < 15; caseIndex++) {
                        if (exception && caseIndex === 4) {
                            inflectedWord[caseIndex] = this.capitalize(exception[2]);
                            continue;
                        }

                        let postfix = pattern[caseIndex];
                        for (let i in this.replacements) {
                            postfix = postfix.replace(i, this.replacements[i]);
                        }

                        let posSlash = postfix.indexOf('/');
                        if (posSlash !== -1) {
                            postfix = animate ? postfix.slice(posSlash + 1) : postfix.slice(0, posSlash);
                        }

                        let result = this.fixAccents(prefix + postfix);
                        if (isUpper) result = this.capitalize(result);
                        inflectedWord[caseIndex] = result;
                    }
                    inflected.push(inflectedWord);
                    gender = pattern[0];
                    break;
                }
            }

            if (!inflectedWord[2]) {
                inflected.push({ ...Array(14).fill(word) });
            }
        }

        let result = [];
        let reversed = inflected.reverse();
        for (let caseIndex = 1; caseIndex < 15; caseIndex++) {
            let partials = reversed.map(word => word[caseIndex]);
            result[caseIndex] = partials.join(' ');
        }
        return result;
    }

    match(pattern, word) {
        if (!pattern.startsWith('-')) {
            return pattern.toLowerCase() === word.toLowerCase() ? 0 : -1;
        }

        let regex = new RegExp(pattern.slice(1) + '$', 'iu');
        let matches = word.match(regex);
        if (matches) {
            for (let i = matches.length - 1; i > 0; i--) {
                this.replacements[i - 1] = matches[matches.length - i];
            }
            return word.length - matches[0].length;
        }
        return -1;
    }

    breakAccents(word) {
        return word.replace(/di|ti|ni|dě|tě|ně/g, match => ({
            'di': 'ďi', 'ti': 'ťi', 'ni': 'ňi', 'dě': 'ďe', 'tě': 'ťe', 'ně': 'ňe'
        }[match]));
    }

    fixAccents(word) {
        return word.replace(/ďi|ťi|ňi|ďe|ťe|ňe/g, match => ({
            'ďi': 'di', 'ťi': 'ti', 'ňi': 'ni', 'ďe': 'dě', 'ťe': 'tě', 'ňe': 'ně'
        }[match]));
    }

    capitalize(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }
}