var wynIntegration = null;
var instance = null;
var selectedReport = null;

function concatUrls(base, rest) {
    base = base.trim();
    rest = rest.trim();
    if (base.substr(base.length - 1) == '/') base = base.substr(0, base.length - 1);
    if (rest.substr(0, 1) == '/') rest = rest.substr(1);
    return `${base}/${rest}`
}

const defaultHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Accept: 'application/json',
    'content-type': 'application/json',
    'pragma': 'no-cache',
};

const makeHeaders = (referenceToken) => ({ ...defaultHeaders, 'Reference-Token': referenceToken });

const postGraphQlRequest = async (portalUrl, referenceToken, requestPayload) => {
    const url = concatUrls(portalUrl, 'api/graphql');
    const init = {
        headers: makeHeaders(referenceToken),
        method: 'post',
        body: JSON.stringify(requestPayload),
    };

    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`${url} status code ${response.status}`);

    const result = await response.json();
    return result;
};

const getReportInfo = async (portalUrl, referenceToken, reportId) => {
    const result = await postGraphQlRequest(portalUrl, referenceToken, {
        query: 'query { reportInfo(reportId: "' + reportId + '") { name, parameters { name, prompt, validValues { values { label, value } } defaultValue { values }} } }',
    });
    const { data: { reportInfo } } = result;
    return reportInfo;
};

async function getReferenceToken(url, user, password) {
    const endpoint = concatUrls(url, 'connect/token')
    const resolveResponse = async (response) => {
        const jsonResponse = await response.json();
        if (jsonResponse.error) return null;
        return jsonResponse.access_token;
    }

    return await fetch(endpoint, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: '*/*',
        },
        method: 'post',
        body: `grant_type=password&username=${user}&password=${password}&client_id=integration&client_secret=eunGKas3Pqd6FMwx9eUpdS7xmz`,
    }).then(async response => {
        let res = await resolveResponse(response)
        return res;
    }).catch(error => {
        alert(error);
        return null;
    });
}

async function getAvailableValues(url, token, reportId, values, requestNames) {

    const endpoint = concatUrls(url, '/api/reporting/reports/' + reportId + '/values2?token=' + token);
    const request = requestNames.reduce((acc, name) => ({ ...acc, [name]: null }), {});
    const body = { values, request };

    const resolveResponse = async (response) => {
        const jsonResponse = await response.json();
        if (jsonResponse.error) return null;
        console.log(jsonResponse);
        return jsonResponse;
    }

    return await fetch(endpoint, {
        headers: {
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(body),
        redirect: 'follow'
    }).then(async response => {
        let res = await resolveResponse(response);
        return res;
    }).catch(error => {
        alert(error);
        return null;
    });
}

async function getReportList(portalUrl, referenceToken) {
    const url = concatUrls(portalUrl, 'api/graphql')
    const init = {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Accept: 'application/json',
            'content-type': 'application/json',
            'pragma': 'no-cache',
            'Reference-Token': referenceToken
        },
        method: 'post',
        body: JSON.stringify({ query: 'query { documenttypes(key:"rdl") { documents{ id, title } } }' })
    };
    const res = await fetch(url, init);
    if (!res.ok) return null
    let response = await res.json()
    let documents = response.data.documenttypes[0].documents;
    let list = documents.map(x => ({ name: x.title, id: x.id }))
    list.sort((x, y) => x.name < y.name ? -1 : 1)
    return list
}

function toggleVisible() {
    document.getElementById('parametersPanel').className = "hide";
}

const createAppSidebar = (portalUrl, username, referenceToken) => {
    document.getElementById('app-portal-url').innerHTML = (
        `<a href="${portalUrl}" target="_blank" rel="noopener noreferrer">${portalUrl}</a>`
    );
    document.getElementById('app-username').innerHTML = username;
    const reportsList = document.getElementById('wyn-report-list');
    let reports = [];

    const sortReports = () => {
        reports = reports.sort((x, y) => x.name.localeCompare(y.name));
    };
    const removeActiveReport = () => {
        const items = reportsList.children;
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('active');
        }
    };

    const createReportElement = (report) => {
        const item = document.createElement('li');
        item.value = report.id;
        const text = document.createElement('span');
        text.innerHTML = report.name;
        item.title = report.name;
        item.appendChild(text);
        item.className = 'wyn-report-list-item';
        item.onclick = () => {
            removeActiveReport();
            item.classList.add('active');
            selectedReport = report;
            appSidebar.onOpenReport(report);
        };
        return item;
    };
    const appSidebar = {
        onLogOut: null,
        onCreateReport: null,
        onReportInDesigner: null,
        onReportInViewer: null,
        onOpenReport: null,
        refreshReportsList: async () => {
            reports = await getReportList(portalUrl, referenceToken);
            sortReports();
            reportsList.innerHTML = '';
            reports.forEach(report => {
                const item = createReportElement(report);
                reportsList.appendChild(item);
            });
        },
        onSavedReport: (report) => {
            let index = reports.findIndex(x => report.id === x.id || report.name === x.name);
            if (index === -1) {
                reports.push(report);
                sortReports();
                index = reports.findIndex(x => report.id === x.id);
                const item = createReportElement(report);
                reportsList.insertBefore(item, reportsList.children[index]);
            }
            removeActiveReport();
            const item = reportsList.children[index];
            item.classList.add('active');
        },
        clearReportList: () => {
            reports = [];
            reportsList.innerHTML = '';
        },
    };
    document.getElementById('app-create-rdl-report').onclick = () => {
        removeActiveReport();
        appSidebar.onCreateReport('CPL');
    };
    document.getElementById('app-create-page-report').onclick = () => {
        removeActiveReport();
        appSidebar.onCreateReport('FPL');
    };
    document.getElementById('app-open-report-designer').onclick = () => {
        appSidebar.onReportInDesigner(selectedReport);
    };

    return appSidebar;
};

const clearContainer = () => {
    const container = document.querySelector('#wyn-root');
    if (container) container.innerHTML = '';
}

const createViewer = async (portalUrl, referenceToken, report, params) => {

    if (instance) {
        instance.destroy();
        clearContainer();
    }

    wynIntegration.createReportViewer({
        baseUrl: portalUrl,
        reportId: report.id,
        lng: 'en',
        token: referenceToken,
        reportParameters: params
        // for v5.0, v5.1 ignore
        //version: '5.0.21782.0',
    }, '#wyn-root').then(ins => {
        instance = ins;
    });
}

const createDesigner = async (portalUrl, referenceToken, onSavedReport, report, reportType) => {

    if (instance) {
        instance.destroy();
        clearContainer();
    }

    let reportId = report != null ? report.id : '';
    wynIntegration.createReportDesigner({
        baseUrl: portalUrl,
        reportId: reportId,
        lng: 'en',
        token: referenceToken,
        onSaved: onSavedReport,
        makeTitle: (reportName, options) => {
            const title = `${reportName}${options.dirty ? ' *' : ''}`;
            return title;
        },
        // for v5.0, v5.1 ignore
        //version: '5.0.21782.0',
    }, '#wyn-root').then(ins => {
        instance = ins;
        instance.closeViewer();
        instance.api.createReport({ reportType });
    });

};

function init() {
    wynIntegration = WynIntegration.WynIntegration;
    const referenceToken = token;

    setTimeout(async () => {
        var rpt = null;
        const appSidebar = await createAppSidebar(portalUrl, username, referenceToken);

        appSidebar.onCreateReport = (reportType) => {
            createDesigner(portalUrl, referenceToken, null, null, reportType);
        };
        appSidebar.onOpenReport = async (report) => {
            rpt = report;
            document.getElementById('app-designer-instructions').classList.add('not-displayed');
            getReportInfo(portalUrl, referenceToken, report.id).then(async (reportInfo) => {
                const parameters = reportInfo && reportInfo.parameters.reduce((params, p) => ({ ...params, [p.name]: p.defaultValue.values && p.defaultValue.values[0] }), {});
                if (reportInfo.parameters.length > 0) {
                    document.getElementById('parametersPanel').className = "show";
                    document.getElementById('docTitle').innerHTML = report.name;
                    document.getElementById("paramEditors").innerHTML = "";
                    document.getElementById('btnRunReport').onclick = null;
                    reportInfo.parameters.map(async (param, i) => {
                        const defaultValue = parameters ? parameters[param.name] : param.defaultValue && param.defaultValue.values && param.defaultValue.values.length > 0 ? param.defaultValue.values : [];
                        const emptyValues = {
                        };
                        const parameterNames = [param.name];//.map(x => x.name);
                        const availableValues = await getAvailableValues(portalUrl, referenceToken, report.id, emptyValues, parameterNames)

                        var paramContainer = document.createElement('div');
                        paramContainer.className = "input-group";
                        var paramName = document.createElement("label");
                        paramName.innerHTML = param.prompt;
                        var paramValueInput;
                        var keys = Object.keys(availableValues);
                        if (keys?.length > 0 && availableValues[keys[0]]["validValues"].length > 0) {
                            paramValueInput = document.createElement('select');
                            paramValueInput.id = param.name + "Input";
                            paramValueInput.className = "paramInput";
                            availableValues[Object.keys(availableValues)[0]]["validValues"].map((val, idx) => {
                                var option = document.createElement("option");
                                option.value = val.value;
                                option.text = val.label;
                                paramValueInput.appendChild(option);
                            });
                        }
                        else {
                            paramValueInput = document.createElement('input');
                            paramValueInput.id = param.name + "Input";
                            paramValueInput.className = "paramInput";
                            paramValueInput.value = Array.isArray(defaultValue) ? defaultValue.join() : defaultValue || "";
                        }
                        paramContainer.appendChild(paramName);
                        paramContainer.appendChild(paramValueInput);
                        document.getElementById("paramEditors").appendChild(paramContainer);

                    });
                    document.getElementById('btnRunReport').onclick = () => {
                        var params = [];
                        reportInfo.parameters.map((param, idx) => {
                            let paramName = String(param.name).replace(/'/g, '&quot;');
                            let paramValue = [String(document.getElementById(paramName + 'Input').value).replace(/'/g, '&quot;')];
                            params.push({ name: paramName, values: paramValue });
                        });
                        createViewer(portalUrl, referenceToken, report, params);
                    };
                }
                else
                    createViewer(portalUrl, referenceToken, report);
            });
        };
        appSidebar.onReportInDesigner = async (report) => {
            createDesigner(portalUrl, referenceToken, appSidebar.onSavedReport, report);
        }
        await appSidebar.refreshReportsList();
    }, 100);
}

window.onload = () => {
    init();
};