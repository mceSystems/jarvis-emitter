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
function executeMiddlewares(middlwareArray, cb, ...initsArgs) {
	let idx = 0;
	const _executeMiddleware = (...args) => {
		const mid = middlwareArray[idx++];
		if (!mid) {
			return cb(...args);
		}
		mid(_executeMiddleware, ...args);
	};
	_executeMiddleware(...initsArgs);
}

const unhandledExceptionCallbacks = [];
const reservedInterfaceNames = ["pipe", "extend", "getRolesHandlers", "getHandlersForName", "then"];
let tmpResolve = null;
let tmpReject = null;
class JarvisEmitter extends Promise {
	/**
	 *
	 * @param interfaceDescriptor
	 * @constructor
	 */
	constructor(interfaceDescriptor = []) {
		// if interfaceDescriptor is a function, it means the constructor was called as part of promise chaining
		super(typeof interfaceDescriptor == "function" ? interfaceDescriptor : (resolve, reject) => {
			tmpResolve = resolve;
			tmpReject = reject;
		});
		// we're hacking our way around promise inheritance:
		// as javascript is single threaded, and super call is synchronous
		// we can rely on the global tmpResolve and tmpReject be assigned only if our super was just called
		// after that, we nullify them, so next constructor call can do the same 
		if (tmpResolve || tmpReject) {
			this.__resolve = this.__resolve || tmpResolve;
			this.__reject = this.__reject || tmpReject;
			tmpResolve = null;
			tmpReject = null;
		} else {
			// reaching here means we're chained - do not extend the instance
			return;
		}

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

		const defaultInterface = [done, error, always, catchPromise, event, notify];
		for (const promiseInterface of defaultInterface) {
			promiseInterface._defaultInterface = true;
		}

		this.extend(defaultInterface.concat(interfaceDescriptor));

		this._allowedRoles.splice(this._allowedRoles.indexOf(JarvisEmitter.role.done), 1);
		this._allowedRoles.splice(this._allowedRoles.indexOf(JarvisEmitter.role.catchException), 1);
		this.__pipeToPromise();
	}
	__pipeToPromise() {
		this.done((...args) => {
			if(!this.__resolve){
				return;
			}
			this.__resolve(...args);
		});
		this.error((...args) => {
			if(!this.__reject){
				return;
			}
			this.__reject(...args);
		});
		this.catch((...args) => {
			if(!this.__reject){
				return;
			}
			this.__reject(...args);
		});
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
			// reserved for promise piping
			if (-1 !== reservedInterfaceNames.indexOf(property.name)) {
				throw new Error(`Property names "${property.name}" is not allowed`);
			}
			if (undefined === property.description) {
				continue;
			}
			if (undefined === property.role && -1 !== this._allowedRoles.indexOf(property.role)) {
				continue;
			}
			const registerer = property.name;
			const pascalCase = `${registerer.charAt(0).toUpperCase()}${registerer.substr(1)}`;
			const resolver = `call${pascalCase}`;
			const remover = `off${pascalCase}`;
			const middleware = `middleware${pascalCase}`;

			const callbackArray = [];
			const middlewareArray = [];
			let stickyCalls = null;
			if (property.sticky) {
				stickyCalls = [];
			}

			const resolvePromise = (...resolveArgs) => {
				try {
					for (const j in callbackArray) {
						callbackArray[j](...resolveArgs);
					}
					if (JarvisEmitter.role.done === property.role && "always" !== property.name) {
						this.callAlways(...resolveArgs);
					}
				} catch (e) {
					this.callCatch.call(null, e);
				}
			};

			this[registerer] = (cb) => {
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
								this.callCatch.call(null, e);
							}
						}
					}
				}
				return this;
			};
			this[remover] = (cb) => {
				if (!cb) {
					callbackArray.splice(0, callbackArray.length);
					return;
				}
				for (const j in callbackArray) {
					if (callbackArray[j] === cb) {
						callbackArray.splice(j, 1);
					}
				}
				return this;
			};
			this[resolver] = (...args) => {
				if (!callbackArray.length) {
					const stack = new Error().stack;
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
						this.callCatch.call(null, e);
					}
				}

				return this;
			};
			this[middleware] = (cb) => {
				middlewareArray.push(cb);
				return this;
			};
			this[registerer].resolver = this[resolver];
			this[registerer].remover = this[remover];
			this[registerer].middleware = this[middleware];
			// keep a reference of the new set of functions
			// so the outside user can get a list of functions by role
			const mapsEntry = {
				registerer: this[registerer],
				resolver: this[resolver],
				remover: this[remover],
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
	 * @param {number} role one of JarvisEmitter.role
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
	 * 		for the JarvisEmitterInterfaceBuilder, the interface name is "actionn"
	 * @returns {object|undefined}
	 */
	getHandlersForName(name) {
		return this._nameMap[name];
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
	 * @returns {{done: number, start: number, catchException: number, notify: number, event: number}}
	 */
	static get role() {
		return {
			done: "done",
			start: "start",
			catchException: "catch",
			notify: "notify",
			event: "event",
		};
	}
	static all(...args) {
		const promise = new JarvisEmitter();
		const results = [];
		let receivedResults = 0;
		if (0 === args.length) {
			promise.callDone([]);
		} else {
			for (const promIdx in args) {
				const prom = args[promIdx];
				prom
					.done((result) => {
						results[promIdx] = result;
						receivedResults++;
						if (receivedResults === args.length) {
							promise.callDone(results);
						}
					})
					.error(promise.callError);
			}
		}
		return promise;
	}

	/**
	 * Gets array of emitters and resolves (emits done) with array of emitted done and error values, 
	 * respective of the order of the emitters argument
	 * If the emitter was resolved (done emitted) the returned array in the original emitter index will contain the result.
	 * If it was rejected (error emitted) will contain undefined in the emitter index.
	 * @param {JarvisEmitter...} emitters The emitters to wait for on their done/error events
	 * @return {JarvisEmitter} An emitter on which the done event is emitted once all emitters emitted done/error
	 */
	static some(...args) {
		const emitter = new JarvisEmitter();
		const results = [];
		let receivedResults = 0;
		if (0 === args.length) {
			emitter.callDone([]);
		} else {
			for (const emitterIdx in args) {
				const em = args[emitterIdx];
				em
					.done((result) => {
						results[emitterIdx] = result;
						receivedResults++;
						if (receivedResults === args.length) {
							emitter.callDone(results);
						}
					})
					.error(() => {
						results[emitterIdx] = undefined;
						receivedResults++;
						if (receivedResults === args.length) {
							emitter.callDone(results);
						}
					});
			}
		}
		return emitter;
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
					return promise.callDone(cbArgs);
				}
				promise.callDone(...cbArgs);
			});
			fn(...callArgs);
			return promise;
		};
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
}

module.exports = JarvisEmitter;
