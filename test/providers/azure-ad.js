'use strict';

// Load modules

const Bell = require('../../');
const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Lab = require('lab');
const Mock = require('../mock');


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('azure-ad', () => {

    it('fails with no tenant', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                expect(Bell.providers['azure-ad']).to.throw(Error);

                mock.stop(done);
            });
        });
    });

    it('sends resource query parameter', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com'
                });
                Hoek.merge(custom, provider);

                const graphResponse = {
                    objectId: 'abcdefg',
                    userPrincipalName: 'steve@example.com',
                    displayName: 'steve smith',
                    givenName: 'steve',
                    surname: 'smith',
                    mail: 'steve@example.com'
                };

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                Mock.override('https://graph.windows.net/example.com/me', graphResponse);

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    Mock.clear();
                    expect(res.headers.location).to.contain('resource=' + encodeURIComponent('https://graph.windows.net/'));
                    mock.stop(done);
                });
            });
        });
    });

    it('authenticates with mock', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com'
                });
                Hoek.merge(custom, provider);

                const graphResponse = {
                    objectId: 'abcdefg',
                    userPrincipalName: 'steve@example.com',
                    displayName: 'steve smith',
                    givenName: 'steve',
                    surname: 'smith',
                    mail: 'steve@example.com'
                };

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                Mock.override('https://graph.windows.net/example.com/me', graphResponse);

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    const cookie = res.headers['set-cookie'][0].split(';')[0] + ';';
                    mock.server.inject(res.headers.location, (mockRes) => {

                        server.inject({ url: mockRes.headers.location, headers: { cookie: cookie } }, (response) => {

                            Mock.clear();
                            expect(response.result).to.deep.equal({
                                provider: 'custom',
                                token: '456',
                                refreshToken: undefined,
                                expiresIn: 3600,
                                query: {},
                                profile: {
                                    id: graphResponse.objectId,
                                    username: graphResponse.userPrincipalName,
                                    displayName: graphResponse.displayName,
                                    email: graphResponse.mail,
                                    name: {
                                        first: graphResponse.givenName,
                                        last: graphResponse.surname
                                    },
                                    raw: graphResponse
                                }
                            });

                            mock.stop(done);
                        });
                    });
                });
            });
        });
    });

    it('does not load /me when requestMe is false', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com',
                    requestMe: false
                });
                Hoek.merge(custom, provider);

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    const cookie = res.headers['set-cookie'][0].split(';')[0] + ';';
                    mock.server.inject(res.headers.location, (mockRes) => {

                        server.inject({ url: mockRes.headers.location, headers: { cookie: cookie } }, (response) => {

                            Mock.clear();
                            expect(response.result).to.deep.equal({
                                provider: 'custom',
                                token: '456',
                                refreshToken: undefined,
                                expiresIn: 3600,
                                query: {}
                            });

                            mock.stop(done);
                        });
                    });
                });
            });
        });
    });

    it('requests additional graph entities, and sets property values', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com',
                    entities: [
                        {
                            path: '/foo',
                            property: 'bar'
                        }
                    ]
                });
                Hoek.merge(custom, provider);

                const graphResponse = {
                    objectId: 'abcdefg',
                    userPrincipalName: 'steve@example.com',
                    displayName: 'steve smith',
                    givenName: 'steve',
                    surname: 'smith',
                    mail: 'steve@example.com'
                };

                const fooResponse = {
                    foo: 'foo'
                };

                Mock.override('https://graph.windows.net/example.com/', (uri, callback) => {

                    let payload = null;

                    if (uri.indexOf('/me') > 0) {
                        payload = graphResponse;
                    }
                    else if (uri.indexOf('/foo') > 0) {
                        payload = fooResponse;
                    }

                    if (payload) {
                        return Hoek.nextTick(callback)(null, { statusCode: 200 }, JSON.stringify(payload));
                    }

                    return Hoek.nextTick(callback)(null, { statusCode: 404 });
                });

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    const cookie = res.headers['set-cookie'][0].split(';')[0] + ';';
                    mock.server.inject(res.headers.location, (mockRes) => {

                        server.inject({ url: mockRes.headers.location, headers: { cookie: cookie } }, (response) => {

                            Mock.clear();
                            expect(response.result).to.deep.equal({
                                provider: 'custom',
                                token: '456',
                                refreshToken: undefined,
                                expiresIn: 3600,
                                query: {},
                                profile: {
                                    bar: fooResponse,
                                    id: graphResponse.objectId,
                                    username: graphResponse.userPrincipalName,
                                    displayName: graphResponse.displayName,
                                    email: graphResponse.mail,
                                    name: {
                                        first: graphResponse.givenName,
                                        last: graphResponse.surname
                                    },
                                    raw: graphResponse
                                }
                            });

                            mock.stop(done);
                        });
                    });
                });
            });
        });
    });

    it('requests additional graph entities, and calls handler', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com',
                    requestMe: false,
                    entities: [
                        {
                            path: '/with-params',
                            params: {
                                entityParam: true
                            },
                            handler: (profile, data) => {

                                profile.custom = data;
                                profile.custom2 = 'test';
                            }
                        }
                    ]
                });
                Hoek.merge(custom, provider);

                Mock.override('https://graph.windows.net/example.com/with-params', (uri, callback) => {

                    Mock.clear();
                    expect(uri).to.contain('entityParam=true');
                    mock.stop(done);
                });

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    const cookie = res.headers['set-cookie'][0].split(';')[0] + ';';
                    mock.server.inject(res.headers.location, (mockRes) => {

                        server.inject({ url: mockRes.headers.location, headers: { cookie: cookie } }, (response) => {});
                    });
                });
            });
        });
    });

    it('requests additional graph entities with parameters', { parallel: false }, (done) => {

        const mock = new Mock.V2();
        mock.start((provider) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', port: 80 });
            server.register(Bell, (err) => {

                expect(err).to.not.exist();

                const custom = Bell.providers['azure-ad']({
                    tenant: 'example.com',
                    entities: [
                        {
                            path: '/foo',
                            property: 'bar'
                        },
                        {
                            path: '/bar',
                            handler: (profile, data) => {

                                profile.custom = data;
                                profile.custom2 = 'test';
                            }
                        }
                    ]
                });
                Hoek.merge(custom, provider);

                const graphResponse = {
                    objectId: 'abcdefg',
                    userPrincipalName: 'steve@example.com',
                    displayName: 'steve smith',
                    givenName: 'steve',
                    surname: 'smith',
                    mail: 'steve@example.com'
                };

                const fooResponse = {
                    foo: 'foo'
                };

                const barResponse = {
                    bar: 'foo'
                };

                Mock.override('https://graph.windows.net/example.com/', (uri, callback) => {

                    let payload = null;

                    if (uri.indexOf('/me') > 0) {
                        payload = graphResponse;
                    }
                    else if (uri.indexOf('/foo') > 0) {
                        payload = fooResponse;
                    }
                    else if (uri.indexOf('/bar') > 0) {
                        payload = barResponse;
                    }

                    if (payload) {
                        return Hoek.nextTick(callback)(null, { statusCode: 200 }, JSON.stringify(payload));
                    }

                    return Hoek.nextTick(callback)(null, { statusCode: 404 });
                });

                server.auth.strategy('custom', 'bell', {
                    password: 'cookie_encryption_password_secure',
                    isSecure: false,
                    clientId: 'azure-ad',
                    clientSecret: 'secret',
                    provider: custom
                });

                server.route({
                    method: '*',
                    path: '/login',
                    config: {
                        auth: 'custom',
                        handler: function (request, reply) {

                            reply(request.auth.credentials);
                        }
                    }
                });

                server.inject('/login', (res) => {

                    const cookie = res.headers['set-cookie'][0].split(';')[0] + ';';
                    mock.server.inject(res.headers.location, (mockRes) => {

                        server.inject({ url: mockRes.headers.location, headers: { cookie: cookie } }, (response) => {

                            Mock.clear();
                            expect(response.result).to.deep.equal({
                                provider: 'custom',
                                token: '456',
                                refreshToken: undefined,
                                expiresIn: 3600,
                                query: {},
                                profile: {
                                    bar: fooResponse,
                                    custom: barResponse,
                                    custom2: 'test',
                                    id: graphResponse.objectId,
                                    username: graphResponse.userPrincipalName,
                                    displayName: graphResponse.displayName,
                                    email: graphResponse.mail,
                                    name: {
                                        first: graphResponse.givenName,
                                        last: graphResponse.surname
                                    },
                                    raw: graphResponse
                                }
                            });

                            mock.stop(done);
                        });
                    });
                });
            });
        });
    });
});
