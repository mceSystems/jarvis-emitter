const {
	expect
} = require("chai");
const JarvisEmitter = require("../");

describe("Native interface 'done'", () => {
	it("should resolve 'done' interface, synchronously, with a constant value 'hello'", () => {
		const emitter = new JarvisEmitter();
		emitter.done((hello) => {
			expect(hello).to.equal("hello")
		});
		emitter.callDone("hello");
	});
	it("should resolve 'done' interface, asynchronously, with a constant value 'hello'", (done) => {
		const emitter = new JarvisEmitter();
		emitter.done((hello) => {
			try {
				expect(hello).to.equal("hello");
			} catch (e) {
				return done(e);
			}
			done();
		});

		setTimeout(() => {
			emitter.callDone("hello");
		}, 500)
	});
	it("should resolve 'done' interface, synchronously, with a constant value 'hello', in a sticky way", () => {
		const emitter = new JarvisEmitter();
		emitter.callDone("hello");
		emitter.done((hello) => {
			expect(hello).to.equal("hello");
		});
	});
	it("should resolve 'done' interface, asynchronously, with a constant value 'hello', in a sticky way", (done) => {
		const emitter = new JarvisEmitter();
		emitter.callDone("hello");
		setTimeout(() => {
			emitter.done((hello) => {
				try {
					expect(hello).to.equal("hello");
				} catch (e) {
					return done(e);
				}
				done();
			});
		}, 500)
	});
});

describe("Native interface 'done' with call, on, off and middleware properties", () => {
	it("should resolve 'done' interface, synchronously, with a constant value 'hello'", () => {
		const emitter = new JarvisEmitter();
		emitter.on.done((hello) => {
			expect(hello).to.equal("hello")
		});
		emitter.call.done("hello");
	});
	it("should resolve 'done' interface, asynchronously, with a constant value 'hello'", (done) => {
		const emitter = new JarvisEmitter();
		emitter.on.done((hello) => {
			try {
				expect(hello).to.equal("hello");
			} catch (e) {
				return done(e);
			}
			done();
		});

		setTimeout(() => {
			emitter.call.done("hello");
		}, 500)
	});
	it("should resolve 'done' interface, synchronously, with a constant value 'hello', in a sticky way", () => {
		const emitter = new JarvisEmitter();
		emitter.call.done("hello");
		emitter.on.done((hello) => {
			expect(hello).to.equal("hello");
		});
	});
	it("should resolve 'done' interface, asynchronously, with a constant value 'hello', in a sticky way", (done) => {
		const emitter = new JarvisEmitter();
		emitter.call.done("hello");
		setTimeout(() => {
			emitter.on.done((hello) => {
				try {
					expect(hello).to.equal("hello");
				} catch (e) {
					return done(e);
				}
				done();
			});
		}, 500)
	});
});

describe("Native interface 'catch'", () => {
	it("should catch thrown exception syncronously", () => {
		const emitter = new JarvisEmitter();
		const errMessage = "test exception message";

		emitter.catch((ex) => {
			expect(ex).to.be.instanceof(Error);
			expect(ex.message).to.equal(errMessage);
		});
		emitter.done(() => {
			throw new Error(errMessage);
		})
		emitter.callDone("hello");
	});
	it("should catch thrown exception asynchronously", (done) => {
		const emitter = new JarvisEmitter();
		const errMessage = "test exception message";

		emitter.catch((ex) => {
			try {
				expect(ex).to.be.instanceof(Error);
				expect(ex.message).to.equal(errMessage);
			} catch (e) {
				return done(e);
			}
			done();
		});
		setTimeout(() => {
			emitter.done(() => {
				throw new Error(errMessage);
			})
			emitter.callDone("hello");
		}, 500);
	});
});

describe("Promise usage", () => {
	it("shouldn't let user extends a 'promise' interface", () => {
		let emitter = new JarvisEmitter([
			JarvisEmitter.interfaceProperty()
			.name("promise")
			.description("bad interface name")
			.role(JarvisEmitter.role.event)
			.build(),
		]);
		expect(emitter.callPromise).to.be.undefined
	});
	it("should resolve the emitter on callDone", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callDone();
		});
		return emitter.promise();
	});
	it("should resolve the emitter on callDone, and check value", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callDone("test");
		});
		return emitter.promise().then((result) => {
			expect(result).to.eql("test");
		});
	});
	it("should reject the emitter on callError", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callError();
		});
		return emitter.promise().then(() => Promise.reject(), () => Promise.resolve())
	});
	it("should reject the emitter on callError, with expected error", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callError("test");
		});
		return emitter.promise().then(() => Promise.reject(), (err) => expect(err).to.eql("test") && Promise.resolve())
	});
	it("should reject the emitter on exception", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callCatch();
		});
		return emitter.promise().then(() => Promise.reject(), () => Promise.resolve())
	});
	it("should reject the emitter on exception, with expected error", () => {
		const emitter = new JarvisEmitter();
		setTimeout(() => {
			emitter.callCatch("test");
		});
		return emitter.promise().then(() => Promise.reject(), (err) => expect(err).to.eql("test") && Promise.resolve())
	});
});

describe("Static function some", () => {
	it("should return resolved and rejected promises results in array", (done) => {
		const errorIdx = 0;
		const successIdx = 1;
		const errorPromise = new JarvisEmitter().callError("error");
		const successPromise = new JarvisEmitter().callDone("success");

		JarvisEmitter.some(errorPromise, successPromise)
			.done((results) => {
				if (undefined === results[errorIdx] && "success" === results[successIdx]) {
					done();
				} else {
					done(new Error(`Expected to get results array of [undefined, "success"] and got: ${JSON.stringify(results)}`));
				}

			})
	})
});


describe("Middlewares", () => {
	describe("Exceptions", () => {
		it("should invoke 'catch' handler if an exception is thrown in a middleware", (done) => {
			const emitter = new JarvisEmitter();
			setTimeout(() => {
				emitter.callDone();
			})

			emitter.middlewareDone(() => {
				throw new Error();
			}).catch(() => {
				done();
			})
		});
		it("should invoke 'catch' handler if an exception is thrown in a middleware, using middleware and call properties", (done) => {
			const emitter = new JarvisEmitter();
			setTimeout(() => {
				emitter.call.done();
			})

			emitter.middleware.done(() => {
				throw new Error();
			}).catch(() => {
				done();
			})
		});
		it("should invoke 'catch' handler if an exception is thrown in a sticky middleware", (done) => {
			const emitter = new JarvisEmitter();

			emitter.callDone();

			emitter.middlewareDone(() => {
				throw new Error();
			}).done(() => {

			}).catch(() => {
				done();
			})
		});
		it("should not invoke the 'catch' handler if an exception is thrown in a 'catch' middleware and invoke unhandledExceptionCallbacks", (done) => {
			const emitter = new JarvisEmitter();
			const exception = new Error();

			const exceptionHandler = (e) => {
				expect(e).to.equal(exception);
				JarvisEmitter.offUnhandledException(exceptionHandler);
				done();
			};
			JarvisEmitter.onUnhandledException(exceptionHandler);

			setTimeout(() => {
				emitter.callDone();
			});

			emitter.done(() => {
				throw new Error();
			});

			emitter.middlewareCatch(() => {
					throw exception;
				})
				.catch(() => {

				});
		});
		it("should not invoke the 'catch' handler if an exception is thrown in a 'catch' sticky middleware and invoke unhandledExceptionCallbacks", (done) => {
			const emitter = new JarvisEmitter();
			const exception = new Error();

			const exceptionHandler = (e) => {
				expect(e).to.equal(exception);
				JarvisEmitter.offUnhandledException(exceptionHandler);
				done();
			};

			JarvisEmitter.onUnhandledException(exceptionHandler);

			emitter.callDone();

			emitter.middlewareCatch(() => {
					throw exception;
				})
				.catch(() => {})
				.done(() => {
					throw new Error();
				});
		});
	});
});

describe("Extensions", () => {
	describe("Using dynamic properties", () => {
		it("should have 'test' handlers", () => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});
			expect(emitter.test).to.not.be.undefined;
			expect(emitter.callTest).to.not.be.undefined;
			expect(emitter.offTest).to.not.be.undefined;
			expect(emitter.middlewareTest).to.not.be.undefined;
		});
		it("should invoke 'test' handler", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});
			setTimeout(() => {
				emitter.callTest();
			})

			emitter.test(() => {
				done()
			})
		});
		it("should invoke 'test' handler with passed value", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});
			setTimeout(() => {
				emitter.callTest("hello");
			})

			emitter.test((a) => {
				try {
					expect(a).to.eq("hello");
					done();
				} catch (e) {
					done(e)
				}
			})
		});
	});
	describe("Using on, off and call properties", () => {
		it("should have 'test' handlers", () => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});
			expect(emitter.on.test).to.not.be.undefined;
			expect(emitter.call.test).to.not.be.undefined;
			expect(emitter.off.test).to.not.be.undefined;
			expect(emitter.middleware.test).to.not.be.undefined;
		});
		it("should invoke 'test' handler", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});

			setTimeout(() => {
				emitter.call.test();
			})

			emitter.on.test(() => {
				done()
			})
		});
		it("should invoke 'test' handler with passed value", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event
			});
			setTimeout(() => {
				emitter.call.test("hello");
			})

			emitter.on.test((a) => {
				try {
					expect(a).to.eq("hello");
					done();
				} catch (e) {
					done(e)
				}
			})
		});
	});

	describe("#stickyLast property", () => {
		it("should act sticky", () => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event,
				stickyLast: true,
			});
			emitter.call.test("hello");
			let value;
			emitter.on.test(val => value = val);
			expect(value).to.equal("hello");
		});
		it("should remember only last value", () => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event,
				stickyLast: true,
			});
			emitter.call.test("hello");
			emitter.call.test("world");
			let value;
			emitter.on.test(val => value = val);
			expect(value).to.equal("world");
		});
		it("should get non-stuck value if registered before emit", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event,
				stickyLast: true,
			});
			emitter.on.test(val => {
				try{
					expect(val).to.equal("hello");
				} catch(e){
					done(e);
				}
				done();
			});
			emitter.call.test("hello");
		});
		it("should act sticky asynchronous", (done) => {
			const emitter = new JarvisEmitter().extend({
				name: "test",
				role: JarvisEmitter.role.event,
				stickyLast: true,
			});
			emitter.call.test("hello");
			setTimeout(() => {
				let value;
				emitter.on.test(val => value = val);
				expect(value).to.equal("hello");
				done();
			}, 0);
		});
	});
});