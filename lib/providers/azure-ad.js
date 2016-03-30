'use strict';

// Load modules
const Joi = require('joi');
const Hoek = require('hoek');

// Declare Internals
const internals = {
    schema: Joi.object({
        resource: Joi.string().default('https://graph.windows.net/'),
        graphUri: Joi.string().default('https://graph.windows.net/'),
        providerUri: Joi.string().default('https://login.windows.net/'),
        apiVersion: Joi.string().default('1.6'),
        tenant: Joi.string().required(),
        requestMe: Joi.boolean().default(true),
        entities: Joi.array().default([]).items(
            Joi.object({
                path: Joi.string().required(),
                property: Joi.string(),
                handler: Joi.func()
            }).or('property', 'handler'))
    }).required()
};

// Exports
exports = module.exports = (options) => {

    const results = Joi.validate(options, internals.schema);

    Hoek.assert(!results.error, results.error);

    const settings = results.value;

    if (settings.requestMe) {
        settings.entities.push({
            path: '/me',
            handler: (profile, data) => {

                profile.id = data.objectId;
                profile.username = data.userPrincipalName;
                profile.displayName = data.displayName;
                profile.email = data.mail;
                profile.name = {
                    first: data.givenName,
                    last: data.surname
                };
                profile.raw = data;
            }
        });
    }

    settings.entities.forEach((entity) => {

        if (entity.property && !entity.handler) {
            entity.handler = (profile, data) => {

                profile[entity.property] = data;
            };
        }
    });

    const graphUri = settings.graphUri + settings.tenant;
    const providerUri = settings.loginUri + settings.tenant;

    return {
        protocol: 'oauth2',
        useParamsAuth: true,
        auth: providerUri + '/oauth2/authorize',
        token: providerUri + '/oauth2/token',
        providerParams: {
            resource: settings.resource
        },
        profile: (credentials, params, get, callback) => {

            const profile = {};
            let inFlight = settings.entities.length;

            if (inFlight === 0) {
                return callback();
            }

            const raiseWhenCompleted = () => {

                inFlight--;
                if (inFlight === 0) {
                    credentials.profile = profile;
                    return callback();
                }
            };

            return settings.entities.forEach((request) => {

                const uri = graphUri + request.path;

                return get(uri, internals.graphQueryParams, (data) => {

                    request.handler(profile, data);
                    return raiseWhenCompleted();
                });
            });
        }
    };
};
