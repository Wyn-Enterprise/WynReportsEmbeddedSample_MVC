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
        token: referenceToken
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
            getReportInfo(portalUrl, referenceToken, report.id).then((reportInfo) => {
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