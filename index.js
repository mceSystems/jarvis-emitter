const debugLog = require("debug")("mce:JarvisEmitter");

class JarvisEmitterInterfaceBuilder {
	constructor() {
		this.object = {};
	}

	name(name) {
		this.object.name = name;
		return this;
	}

	role(role) {
		this.object.role = role;
		return this;
	}

	sticky(sticky) {
		this.object.sticky = sticky;
		return this;
	}

	description(description) {
		this.object.description = description;
		return this;
	}

	build() {
		return this.object;
	}
}

function executeMiddlewares(middlewareArray, cb, ...initsArgs) {
	if (0 === middlewareArray.length) {
		cb(...initsArgs);
		return;
	}
	let idx = 0;
	const _executeMiddleware = (...args) => {
		const mid = middlewareArray[idx++];
		if (!mid) {
			return cb(...args);
		}
		mid(_executeMiddleware, ...args);
	};
	_executeMiddleware(...initsArgs);
}

const unhandledExceptionCallbacks = [];
const reservedInterfaceNames = ["pipe", "extend", "getRolesHandlers", "getHandlersForName", "promise", "on", "off", "middleware", "call"];
class JarvisEmitter {
	/**
	 *
	 * @param interfaceDescriptor
	 * @constructor
	 */
	constructor(interfaceDescriptor = []) {
		this.destroyed = false;
		this.on = {};
		this.off = {};
		this.call = {};
		this.middleware = {};
		this._allowedRoles = [];
		// promise interfaces handlers by role
		this._roleMap = {};
		// promise interfaces handlers by name
		this._nameMap = {};

		for (const i in JarvisEmitter.role) {
			this._allowedRoles.push(JarvisEmitter.role[i]);
			this._roleMap[JarvisEmitter.role[i]] = {
				defaultInterface: [],
				userCreated: [],
			};
		}

		const done =
			JarvisEmitter.interfaceProperty()
				.name("done")
				.role(JarvisEmitter.role.done)
				.sticky(true)
				.description("Called when the operation is done successfully.")
				.build();
		const error =
			JarvisEmitter.interfaceProperty()
				.name("error")
				.role(JarvisEmitter.role.done)
				.sticky(true)
				.description("Called when the operation is done with errors.")
				.build();
		const always =
			JarvisEmitter.interfaceProperty()
				.name("always")
				.role(JarvisEmitter.role.done)
				.sticky(true)
				.description("Called when the operation is done either successfully or with errors.")
				.build();
		const catchPromise =
			JarvisEmitter.interfaceProperty()
				.name("catch")
				.role(JarvisEmitter.role.catchException)
				.sticky(true)
				.description("Called if an exception is thrown during the operation")
				.build();
		const event =
			JarvisEmitter.interfaceProperty()
				.name("event")
				.role(JarvisEmitter.role.event)
				.description("Called if an event has occurred during the operation")
				.build();
		const notify =
			JarvisEmitter.interfaceProperty()
				.name("notify")
				.role(JarvisEmitter.role.notify)
				.description("Should be called if a notification should be sent during the operation")
				.build();
		const tap =
			JarvisEmitter.interfaceProperty()
				.name("tap")
				.role(JarvisEmitter.role.observe)
				.description("Should be called when any role \"resolves\"")
				.build();

		const defaultInterface = [done, error, always, catchPromise, event, notify, tap];
		for (const promiseInterface of defaultInterface) {
			promiseInterface._defaultInterface = true;
		}

		this.extend(defaultInterface.concat(interfaceDescriptor));

		this._allowedRoles.splice(this._allowedRoles.indexOf(JarvisEmitter.role.done), 1);
		this._allowedRoles.splice(this._allowedRoles.indexOf(JarvisEmitter.role.catchException), 1);
	}

	/**
	 *
	 * @param interfaceDescription
	 */
	extend(interfaceDescription = []) {
		if (!Array.isArray(interfaceDescription)) {
			// eslint-disable-next-line no-param-reassign
			interfaceDescription = [interfaceDescription];
		}
		for (const i in interfaceDescription) {
			const property = interfaceDescription[i];
			if (undefined === property.name) {
				continue;
			}
			if (undefined === property.role && -1 !== this._allowedRoles.indexOf(property.role)) {
				continue;
			}
			const registerer = property.name;
			const { resolver, remover, middleware } = this.__namesFromRegisterer(registerer);

			let callbackArray = [];
			let middlewareArray = [];
			let stickyCalls = null;
			let stickyLastMode = null;

			if (property.stickyLast) {
				stickyLastMode = true;
				property.sticky = true;
			}

			if (property.sticky) {
				stickyCalls = [];
			}

			const resolvePromise = (...resolveArgs) => {
				this.__assertValid();

				try {
					for (const j in callbackArray) {
						callbackArray[j](...resolveArgs);
					}
					if (JarvisEmitter.role.done === property.role && "always" !== property.name) {
						this.call.always(...resolveArgs);
					}

					if ("always" !== property.name && "tap" !== property.name) {
						this.call.tap({
							name: property.name,
							role: property.role,
							data: resolveArgs
						});
					}
				} catch (e) {
					this.call.catch.call(null, e);
				}
			};

			const registererCb = (cb) => {
				this.__assertValid();

				callbackArray.push(cb);
				if (stickyCalls) {
					for (const args of stickyCalls) {
						try {
							executeMiddlewares(middlewareArray, cb, ...args);
						} catch (e) {
							if ("catch" === property.name) {
								unhandledExceptionCallbacks.forEach((cb) => {
									cb(e);
								});
							} else {
								this.call.catch.call(null, e);
							}
						}
					}
				}
				return this;
			};
			const removerCb = (cb) => {
				this.__assertValid();

				if (!cb) {
					callbackArray.splice(0, callbackArray.length);
					return;
				}
				for (const j in callbackArray) {
					if (callbackArray[j] === cb) {
						callbackArray.splice(parseInt(j, 10), 1);
					}
				}
				return this;
			};
			const resolverCb = (...args) => {
				this.__assertValid();

				if (!callbackArray.length) {
					const { stack } = new Error();
					if ("error" === property.name) {
						setTimeout(() => {
							if (!callbackArray.length) {
								debugLog("Unhandled JarvisEmitter error occurred, with arguments", args, stack);
							}
						}, 0);
					} else if ("catch" === property.name) {
						debugLog("Unhandled JarvisEmitter exception occurred, with arguments", args, stack);
						unhandledExceptionCallbacks.forEach((cb) => {
							cb(...args);
						});
					} else if (JarvisEmitter.role.catchException === property.role) {
						debugLog(`Unhandled JarvisEmitter exception (name=${property.name}) occurred, with arguments`, args, stack);
					}
				}

				if (stickyCalls) {
					if (stickyLastMode) {
						//remove an element before adding - will always remain with 0 or 1 elements
						stickyCalls.pop();
					}
					stickyCalls.push(args);
				}

				try {
					executeMiddlewares(middlewareArray, resolvePromise, ...args);
				} catch (e) {
					if ("catch" === property.name) {
						unhandledExceptionCallbacks.forEach((cb) => {
							cb(e);
						});
					} else {
						this.call.catch.call(null, e);
					}
				}

				return this;
			};
			const middlewareCb = (cb) => {
				this.__assertValid();

				middlewareArray.push(cb);
				return this;
			};
			const purge = () => {
				callbackArray = [];
				middlewareArray = [];
				if (stickyCalls) {
					stickyCalls = [];
				}
			};

			registererCb.resolver = resolverCb;
			registererCb.remover = removerCb;
			registererCb.middleware = middlewareCb;

			this.on[registerer] = registererCb;
			this.call[registerer] = resolverCb;
			this.off[registerer] = removerCb;
			this.middleware[registerer] = middlewareCb;

			// reserved for promise piping
			if (-1 === reservedInterfaceNames.indexOf(property.name)) {
				this[registerer] = registererCb;
				this[remover] = removerCb;
				this[resolver] = resolverCb;
				this[middleware] = middlewareCb
			}

			// keep a reference of the new set of functions
			// so the outside user can get a list of functions by role
			const mapsEntry = {
				purge,
				registerer: registererCb,
				resolver: resolverCb,
				remover: removerCb,
				middleware: middlewareCb,
				name: registerer,
				role: property.role,
			};

			if (property._defaultInterface) {
				this._roleMap[property.role].defaultInterface.push(mapsEntry);
			} else {
				this._roleMap[property.role].userCreated.push(mapsEntry);
			}

			this._nameMap[registerer] = mapsEntry;
		}
		return this;
	}

	/**
	 * Pipes all interface properties handlers to the given promise instance.
	 * @param {JarvisEmitter} pipedPromise
	 *
	 * @memberOf JarvisEmitter
	 */
	pipe(pipedPromise) {
		if (!pipedPromise || !pipedPromise) {
			return;
		}
		for (const name in this._nameMap) {
			const handler = this._nameMap[name];
			if (handler.registerer) {
				handler.registerer((...args) => {
					const pipedHandler = pipedPromise.getHandlersForName(handler.name);
					if (pipedHandler) {
						pipedHandler.resolver(...args);
					}
				});
			}
		}
		return this;
	}

	/**
	 * Returns and array of objects, each with the registerer functions
	 * 		and the resolver function of the specified role.
	 * if defaultsOnly is passed as true, the returned objects in the array
	 * 		are only the default promise interface handlers.
	 * if defaultsOnly is passed as false, the returned objects in the array
	 * 		are only the handlers defined on top of the defaults.
	 * if defaultsOnly is not defined, the returned objects in the array
	 * 		are all role handlers (default and over-the-top).
	 * @param {string} role one of JarvisEmitter.role
	 * @param {boolean} defaultsOnly
	 * @returns {*|Array}
	 */
	getRolesHandlers(role, defaultsOnly) {
		if (undefined === defaultsOnly) {
			return this._roleMap[role].defaultInterface.concat(this._roleMap[role].userCreated);
		}
		if (defaultsOnly) {
			return this._roleMap[role].defaultInterface;
		}
		return this._roleMap[role].userCreated;
	}

	/**
	 * Returns the object containing the registerer, remover and resolver functions
	 * 		for the interface property registered with the specified name.
	 * Returns undefined if no such interface property exists.
	 * Usage: promise.getHandlersForName("done").resolver(); //this will resolve the "done" callbacks.
	 * @param {string} name The name of the promise interface.
	 * 		For example, if an interface was extended using the name "action"
	 * 		for the JarvisEmitterInterfaceBuilder, the interface name is "action"
	 * @param {string} [role] The role of the promise interface.
	 * @returns {object|undefined}
	 */
	getHandlersForName(name, role) {
		if (this._nameMap[name]) {
			return this._nameMap[name];
		}

		return {
			...this._nameMap["tap"],
			resolver: (...data) => this._nameMap["tap"].resolver({
				data,
				name,
				role
			})
		};
	}

	promise() {
		return new Promise((resolve, reject) => {
			this.on.done((...args) => {
				resolve(...args)
			});
			this.on.error((...args) => {
				reject(...args);
			});
			this.on.catch((...args) => {
				reject(...args);
			});
		});
	}

	/**
	 *
	 * @returns {JarvisEmitterInterfaceBuilder}
	 */
	static interfaceProperty() {
		return new JarvisEmitterInterfaceBuilder();
	}

	/**
	 *
	 * @returns {{done: string, start: string, catchException: string, notify: string, event: string, observe: string}}
	 */
	static get role() {
		return {
			done: "done",
			start: "start",
			catchException: "catch",
			notify: "notify",
			event: "event",
			observe: "observe"
		};
	}

	static all(...args) {
		const promise = new JarvisEmitter();
		const results = [];
		let receivedResults = 0;
		if (0 === args.length) {
			promise.call.done([]);
		} else {
			for (const promIdx in args) {
				const prom = args[promIdx];
				prom
					.done((result) => {
						results[promIdx] = result;
						receivedResults++;
						if (receivedResults === args.length) {
							promise.call.done(results);
						}
					})
					.error(promise.call.error);
			}
		}
		return promise;
	}

	/**
	 * Gets array of emitters and resolves (emits done) with array of emitted done and error values,
	 * respective of the order of the emitters argument
	 * If the emitter was resolved (done emitted) the returned array in the original emitter index will contain the result.
	 * If it was rejected (error emitted) will contain undefined in the emitter index.
	 * @param {...JarvisEmitter} args The emitters to wait for on their done/error events
	 * @return {JarvisEmitter} An emitter on which the done event is emitted once all emitters emitted done/error
	 */
	static some(...args) {
		const emitter = new JarvisEmitter();
		const results = [];
		let receivedResults = 0;
		if (0 === args.length) {
			emitter.call.done([]);
		} else {
			for (const emitterIdx in args) {
				const em = args[emitterIdx];
				em
					.on.done((result) => {
						results[emitterIdx] = result;
						receivedResults++;
						if (receivedResults === args.length) {
							emitter.call.done(results);
						}
					})
					.error(() => {
						results[emitterIdx] = undefined;
						receivedResults++;
						if (receivedResults === args.length) {
							emitter.call.done(results);
						}
					});
			}
		}
		return emitter;
	}


	/**
	 * Emitter should not be re-used after being destroyed
	 */
	destroy() {
		Object.keys(this._nameMap).forEach((registerer) => {
			this._nameMap[registerer].purge();
		});
		this.destroyed = true;
	}

	static immediate(result, role = JarvisEmitter.role.done, name = "done") {
		const promise = new JarvisEmitter();
		promise.getRolesHandlers(role, true).forEach((promiseInterface) => {
			if (promiseInterface.name === name && promiseInterface.resolver) {
				promiseInterface.resolver(result);
			}
		});

		return promise;
	}

	static emitify(fn, resultsAsArray = true, cbIndex) {
		return (...callArgs) => {
			const promise = new JarvisEmitter();
			const idx = undefined === cbIndex ? callArgs.length : cbIndex;
			callArgs.splice(idx, 0, (...cbArgs) => {
				if (resultsAsArray) {
					return promise.call.done(cbArgs);
				}
				promise.call.done(...cbArgs);
			});
			fn(...callArgs);
			return promise;
		};
	}

	static emitifyFromAsync(fn) {
		return (...callArgs) => {
			const promise = new JarvisEmitter();

			fn(...callArgs)
				.then((thenResult) => {
					promise.call.done(thenResult);
				})
				.catch((catchResult) => {
					promise.call.error(catchResult);
				});

			return promise;
		}
	}

	static onUnhandledException(cb) {
		unhandledExceptionCallbacks.push(cb);
	}

	static offUnhandledException(cb) {
		const idx = unhandledExceptionCallbacks.indexOf(cb);
		if (idx !== -1) {
			unhandledExceptionCallbacks.splice(idx, 1);
		}
	}

	__namesFromRegisterer(registerer) {
		const pascalCase = `${registerer.charAt(0).toUpperCase()}${registerer.substr(1)}`;
		return {
			resolver: `call${pascalCase}`,
			remover: `off${pascalCase}`,
			middleware: `middleware${pascalCase}`,
		};
	}

	__assertValid() {
		if (this.destroyed) {
			throw new Error(`JarvisEmitter used after being destroyed`);
		}
	}
}

JarvisEmitter.Role = {
	done: "done",
	catchException: "catch",
	notify: "notify",
	event: "event",
	observe: "observe",
};

module.exports = JarvisEmitter;
