const { expect } = require("chai");
const JarvisEmmiter = require("../");

describe("Native interface 'done'", () => {
	it("should resolve 'done' interface, syncronously, with a constant value hello 'hello'", () => {
		const emitter = new JarvisEmmiter();
		emitter.done((hello) => {
			expect(hello).to.equal("hello")
		});
		emitter.callDone("hello");
	});
	it("should resolve 'done' interface, asyncronously, with a constant value 'hello'", (done) => {
		const emitter = new JarvisEmmiter();
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
		const emitter = new JarvisEmmiter();
		emitter.callDone("hello");
		emitter.done((hello) => {
			expect(hello).to.equal("hello");
		});
	});
	it("should resolve 'done' interface, asyncronously, with a constant value 'hello', in a sticky way", (done) => {
		const emitter = new JarvisEmmiter();
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
		const emitter = new JarvisEmmiter();
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
		const emitter = new JarvisEmmiter();
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