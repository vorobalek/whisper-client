function getTemplateParameters(env) {
    let parameters = {};
    switch (env.environment) {
        case 'local':
            parameters = {
                WHISPER_CONSOLE_LOG_LEVEL: 'trace',
                WHISPER_DOCUMENT_LOG_LEVEL: 'info',
                WHISPER_SERVER_URL:
                    env.CODESPACES === 'true' && env.CODESPACE_NAME !== undefined
                        ? `https://${env.CODESPACE_NAME}-5027.app.github.dev`
                        : 'http://localhost:5027',
                WHISPER_FRONTEND_URL:
                    env.CODESPACES === 'true' && env.CODESPACE_NAME !== undefined
                        ? `https://${env.CODESPACE_NAME}-8080.app.github.dev`
                        : 'http://localhost:8080',
                WHISPER_VAPID_KEY:
                    env.WHISPER_VAPID_KEY ||
                    'BDJvWjwP8E1UQpbH1GecXj29D0toqjTIRE4jGfeChwBPX86oHP_9PNcyUoxM-Uo41v_oOJtGB559oQVhEmpsv-I',
            };
            break;
        case 'staging':
            parameters = {
                WHISPER_CONSOLE_LOG_LEVEL: 'trace',
                WHISPER_DOCUMENT_LOG_LEVEL: 'info',
                WHISPER_SERVER_URL: 'https://cluster.vorobalek.dev/whisper',
                WHISPER_FRONTEND_URL: 'https://whisper.vorobalek.dev',
                WHISPER_VAPID_KEY:
                    'BHAYDRAjMWXfg7dxFIOZYNLlxrVDohy_PbN7SXcrXapiZq0Jnt0VXsAx6ytkLArVVFDSfula4VRWm5HDvkVVRbA',
            };
            break;
    }
    parameters = {
        WHISPER_BUILD_TIMESTAMP: Date.now(),
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
