const { expect } = require("chai");
const JarvisEmitter = require("../");

describe("Native interface 'done'", () => {
	it("should resolve 'done' interface, syncronously, with a constant value 'hello'", () => {
		const emitter = new JarvisEmitter();
		emitter.done((hello) => {
			expect(hello).to.equal("hello")
		});
		emitter.callDone("hello");
	});
	it("should resolve 'done' interface, asyncronously, with a constant value 'hello'", (done) => {
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
	it("should resolve 'done' interface, syncronously, with a constant value 'hello', in a sticky way", () => {
		const emitter = new JarvisEmitter();
		emitter.callDone("hello");
		emitter.done((hello) => {
			expect(hello).to.equal("hello");
		});
	});
	it("should resolve 'done' interface, asyncronously, with a constant value 'hello', in a sticky way", (done) => {
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
	it("should catch thrown exception asyncronously", (done) => {
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
				}
				else {
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
				.catch(() => { })
				.done(() => {
					throw new Error();
				});
		});
	});
});