function getTemplateParameters(environment) {
    let parameters = {};
    switch (environment) {
        case 'serve':
            parameters = {
                CONSOLE_LOG_LEVEL: 'trace',
                DOCUMENT_LOG_LEVEL: 'info',
                SERVER_URL: 'http://localhost:5027',
                FRONTEND_URL: 'http://localhost:8080',
                VAPID_KEY: 'BDJvWjwP8E1UQpbH1GecXj29D0toqjTIRE4jGfeChwBPX86oHP_9PNcyUoxM-Uo41v_oOJtGB559oQVhEmpsv-I',
            };
            break;
        case 'local':
            parameters = {
                CONSOLE_LOG_LEVEL: 'trace',
                DOCUMENT_LOG_LEVEL: 'info',
                SERVER_URL: 'http://localhost:5027',
                FRONTEND_URL: 'http://localhost:8080',
                VAPID_KEY: 'BDJvWjwP8E1UQpbH1GecXj29D0toqjTIRE4jGfeChwBPX86oHP_9PNcyUoxM-Uo41v_oOJtGB559oQVhEmpsv-I',
            };
            break;
        case 'staging':
            parameters = {
                CONSOLE_LOG_LEVEL: 'trace',
                DOCUMENT_LOG_LEVEL: 'info',
                SERVER_URL: 'https://cluster.vorobalek.dev/whisper',
                FRONTEND_URL: 'https://whisper.vorobalek.dev',
                VAPID_KEY: 'BHAYDRAjMWXfg7dxFIOZYNLlxrVDohy_PbN7SXcrXapiZq0Jnt0VXsAx6ytkLArVVFDSfula4VRWm5HDvkVVRbA',
            };
            break;
    }
    parameters = {
        BUILD_TIMESTAMP: Date.now(),
        ...parameters,
    };
    console.log(JSON.stringify(parameters, null, 2));
    return parameters;
}

function getEnvironmentVariables(templateParameters) {
    return Object.entries(templateParameters).reduce((acc, [key, value]) => {
        acc[key] = JSON.stringify(value);
        return acc;
    }, {});
}
function getParameterReplacer(templateParameters) {
    return (content, file) => {
        return content.toString().replaceAll(/(__([A-Z_]*)__)/g, (match, p1, p2) => {
            const value = templateParameters[p2];
            console.log(`[${file}] replaced ${p1} => ${value}`);
            return value;
        });
    };
}
module.exports = {
    getTemplateParameters,
    getEnvironmentVariables,
    getParameterReplacer,
};
