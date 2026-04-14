import JarvisEmitter, { DefaultInterfaces, Role, Property } from "..";

// ─── helpers ───────────────────────────────────────────────────────────────────

type AssertEqual<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;
type Assert<T extends true> = T;

interface GyroscopeData { x: number; y: number; z: number }
class ServiceError extends Error { code = 0; }

// ─── 1. extend — generic overload (new style) ─────────────────────────────────

// 1a. Explicit K + V
{
	const em = new JarvisEmitter<void, Error>()
		.extend<"action", string>({ name: "action", role: Role.event });

	type _on = Assert<AssertEqual<Parameters<Parameters<typeof em.on.action>[0]>[0], string>>;
	type _call = Assert<AssertEqual<Parameters<typeof em.call.action>[0], string>>;
}

// 1b. V defaults to void for new keys
{
	const em = new JarvisEmitter<void, Error>()
		.extend({ name: "stop", role: Role.notify });

	type _on = Assert<AssertEqual<Parameters<Parameters<typeof em.on.stop>[0]>[0], void>>;
}

// 1c. Array of descriptors
{
	const em = new JarvisEmitter<void, Error>()
		.extend([
			{ name: "a" as const, role: Role.event },
			{ name: "b" as const, role: Role.notify },
		]);

	type _a = Assert<AssertEqual<Parameters<Parameters<typeof em.on.a>[0]>[0], void>>;
	type _b = Assert<AssertEqual<Parameters<Parameters<typeof em.on.b>[0]>[0], void>>;
}

// ─── 2. extend — legacy emittedType overload ───────────────────────────────────

{
	const em = new JarvisEmitter<void, Error>()
		.extend({ name: "data", role: Role.event, emittedType: 0 as number });

	type _on = Assert<AssertEqual<Parameters<Parameters<typeof em.on.data>[0]>[0], number>>;
}

// ─── 3. extend — class-level Interfaces + extend preserves types ───────────────

{
	interface MyInterfaces extends DefaultInterfaces<void, ServiceError> {
		gyroscopeData: GyroscopeData;
		stop: void;
	}

	const em = new JarvisEmitter<void, ServiceError, MyInterfaces>()
		.extend({ name: "gyroscopeData", role: Role.event })
		.extend({ name: "stop", role: Role.notify });

	type _gyro = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.gyroscopeData>[0]>[0],
		GyroscopeData
	>>;
	type _stop = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.stop>[0]>[0],
		void
	>>;
	type _done = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.done>[0]>[0],
		void
	>>;
	type _err = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.error>[0]>[0],
		ServiceError
	>>;
}

// ─── 4. extend — generic V overrides class-level Interfaces ────────────────────

{
	interface MyInterfaces extends DefaultInterfaces<void, Error> {
		action: string;
	}

	const em = new JarvisEmitter<void, Error, MyInterfaces>()
		.extend<"action", number>({ name: "action", role: Role.event });

	type _overridden = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.action>[0]>[0],
		number
	>>;
}

// ─── 5. middleware — preserves DoneType / ErrorType ────────────────────────────

{
	interface MyInterfaces extends DefaultInterfaces<void, ServiceError> {
		data: string;
		stop: void;
	}

	const em = new JarvisEmitter<void, ServiceError, MyInterfaces>()
		.extend({ name: "data", role: Role.event })
		.extend({ name: "stop", role: Role.notify });

	const piped = em.middleware.error((next, err) => {
		next(new ServiceError(err.message));
	});

	type _errType = Assert<AssertEqual<
		Parameters<Parameters<typeof piped.on.error>[0]>[0],
		ServiceError
	>>;
	type _dataType = Assert<AssertEqual<
		Parameters<Parameters<typeof piped.on.data>[0]>[0],
		string
	>>;
}

// ─── 6. middleware — default ChangedArg preserves existing type ─────────────────

{
	const em = new JarvisEmitter<string, Error>();

	const piped = em.middleware.done((next, val) => {
		next(val);
	});

	type _done = Assert<AssertEqual<
		Parameters<Parameters<typeof piped.on.done>[0]>[0],
		string
	>>;
}

// ─── 7. chained extend calls ───────────────────────────────────────────────────

{
	const em = new JarvisEmitter<void, Error>()
		.extend<"a", number>({ name: "a", role: Role.event })
		.extend<"b", string>({ name: "b", role: Role.notify })
		.extend<"c", boolean>({ name: "c", role: Role.event });

	type _a = Assert<AssertEqual<Parameters<Parameters<typeof em.on.a>[0]>[0], number>>;
	type _b = Assert<AssertEqual<Parameters<Parameters<typeof em.on.b>[0]>[0], string>>;
	type _c = Assert<AssertEqual<Parameters<Parameters<typeof em.on.c>[0]>[0], boolean>>;
	type _done = Assert<AssertEqual<Parameters<Parameters<typeof em.on.done>[0]>[0], void>>;
}

// ─── 8. Resolver is variadic ───────────────────────────────────────────────────

{
	const em = new JarvisEmitter<string, Error>();
	em.call.done("result", 1 as unknown, 2 as unknown);
}

// ─── 9. Remover with optional listener ─────────────────────────────────────────

{
	const em = new JarvisEmitter<string, Error>();
	const listener = (_arg: string) => { };
	em.on.done(listener);
	em.off.done(listener);
	em.off.done();
}

// ─── 10. static all / some preserve types ──────────────────────────────────────

{
	const a = new JarvisEmitter<string, Error>();
	const b = new JarvisEmitter<number, Error>();

	const all = JarvisEmitter.all(a, b);
	type _allDone = Assert<AssertEqual<
		Parameters<Parameters<typeof all.on.done>[0]>[0],
		(string | number)[]
	>>;

	const some = JarvisEmitter.some(a, b);
	type _someDone = Assert<AssertEqual<
		Parameters<Parameters<typeof some.on.done>[0]>[0],
		(string | number | undefined)[]
	>>;
}

// ─── 11. emitifyFromAsync ──────────────────────────────────────────────────────

{
	async function fetchData(url: string): Promise<{ data: string }> {
		return { data: url };
	}

	const emitified = JarvisEmitter.emitifyFromAsync(fetchData);
	const em = emitified("http://example.com");

	type _done = Assert<AssertEqual<
		Parameters<Parameters<typeof em.on.done>[0]>[0],
		{ data: string }
	>>;
}

// ─── 12. promise() returns Promise<DoneType> ──────────────────────────────────

{
	const em = new JarvisEmitter<number, Error>();
	const p = em.promise();

	type _p = Assert<AssertEqual<typeof p, Promise<number>>>;
}

// ─── 13. constructor accepts Property array ────────────────────────────────────

{
	const props: Property<"custom", string>[] = [
		{ name: "custom", role: Role.event, emittedType: "" }
	];
	const em = new JarvisEmitter(props);
}

// ─── 14. getRolesHandlers accepts defaultsOnly ─────────────────────────────────

{
	const em = new JarvisEmitter();
	em.getRolesHandlers(Role.event);
	em.getRolesHandlers(Role.event, true);
	em.getRolesHandlers(Role.event, false);
}

// ─── 15. full factory pattern (matches real-world usage) ───────────────────────

{
	interface SensorInterfaces extends DefaultInterfaces<void, ServiceError> {
		sensorData: GyroscopeData;
		stop: void;
	}
	type SensorEmitter = JarvisEmitter<void, ServiceError, SensorInterfaces>;

	function createSensorEmitter(): SensorEmitter {
		return new JarvisEmitter<void, ServiceError, SensorInterfaces>()
			.extend({ name: "sensorData", role: Role.event })
			.extend({ name: "stop", role: Role.notify });
	}

	const sensor = createSensorEmitter();
	sensor.on.sensorData((data) => {
		const _x: number = data.x;
	});
	sensor.middleware.error((next, err) => {
		next(new ServiceError(err.message));
	});
}


{
	interface SensorInterfaces extends DefaultInterfaces<void, NewError> {
		sensorData: GyroscopeData;
		someEvent: { a: string, b: number };
		stop: void;
	}
	type NewError = { newCode: number };
	type SensorEmitter = JarvisEmitter<void, NewError, SensorInterfaces>;

	function createSensorEmitter(): SensorEmitter {
		return new JarvisEmitter<SensorInterfaces["done"], SensorInterfaces["error"]>()
			.extend<"sensorData", GyroscopeData>({ name: "sensorData", role: Role.event })
			.extend<"stop", void>({ name: "stop", role: Role.notify })
			.extend<"someEvent", { a: string, b: number }>({ name: "someEvent", role: Role.event })
			.middleware.error((next, err) => {
				const newErr = { ...err, newCode: 1 };
				next(newErr);
			});
	}

	const sensor = createSensorEmitter();
	sensor.on.sensorData((data) => {
		const _x: number = data.x;
	});
	sensor.on.someEvent((data) => {
		const _a: string = data.a;
		const _b: number = data.b;
	});
	sensor.on.error((err) => {
		const _err = err; // error type is ServiceError
	});
}

//---- complex case ----
{
	enum HomingStatus {
		homing = "homing",
		homed = "homed",
		error = "error",
	}
	
	interface PlcId {
		ipAddress: string;
		port: number;
	}

	interface RadiantId {
		ipAddress: string;
		port: number;
	}

	type XyPlcDoneType = Record<string, unknown> | {
		movedTo: {
			fingerId: number;
			x: number;
			y: number;
		};
	} | HomingStatus;

	interface XyPlcEmitterInterfaces {
		ready: void;
		moveXy: {
			plcId: PlcId;
			fingerId: number;
			x: number;
			y: number;
		};
		moveX: {
			plcId: PlcId;
			fingerId: number;
			x: number;
		};
		moveY: {
			plcId: PlcId;
			fingerId: number;
			y: number;
		};
		getXPosition: {
			plcId: PlcId;
			fingerId: number;
		};
		getYPosition: {
			plcId: PlcId;
			fingerId: number;
		};
		setFingerHeight: {
			plcId: PlcId;
			fingerId: number;
			height: number;
		};
		getZPosition: {
			plcId: PlcId;
			fingerId: number;
		};
		changeFingerType: {
			plcId: PlcId;
			fingerId: number;
			fingerTypeIndex: number;
		};
		getActiveFingerType: {
			plcId: PlcId;
			fingerId: number;
		};
		moveSupportPlatform: {
			plcId: PlcId;
			cellId: number;
			requiredPos: number;
		};
		getSupportPlatformPosition: {
			plcId: PlcId;
			cellId: number;
		};
		startHoming: {
			plcId: PlcId;
			fingerId: number;
		};
		getHomingXStatus: {
			plcId: PlcId;
			fingerId: number;
		};
		getHomingYStatus: {
			plcId: PlcId;
			fingerId: number;
		};
		getHomingZStatus: {
			plcId: PlcId;
			fingerId: number;
		};
		startXHoming: {
			plcId: PlcId;
			fingerId: number;
		};
		startYHoming: {
			plcId: PlcId;
			fingerId: number;
		};
	}

	type FullXyPlcInterfaces = DefaultInterfaces<XyPlcDoneType, Error> & XyPlcEmitterInterfaces;
	type XyPlcEmitter = JarvisEmitter<XyPlcDoneType, Error, FullXyPlcInterfaces>;

	function createXyPlcEmitter(): XyPlcEmitter {
		return new JarvisEmitter<XyPlcDoneType, Error, FullXyPlcInterfaces>()
			.extend({
				name: "ready",
				role: Role.event,
				sticky: true,
			}).extend({
				name: "moveXy",
				role: Role.notify,
			}).extend({
				name: "moveX",
				role: Role.notify,
			})
			.extend({
				name: "moveY",
				role: Role.notify,
			})
			.extend({
				name: "getXPosition",
				role: Role.notify,
			})
			.extend({
				name: "getYPosition",
				role: Role.notify,
			})
			.extend({
				name: "setFingerHeight",
				role: Role.notify,
			})
			.extend({
				name: "getZPosition",
				role: Role.notify,
			})
			.extend({
				name: "changeFingerType",
				role: Role.notify,
			})
			.extend({
				name: "getActiveFingerType",
				role: Role.notify,
			})
			.extend({
				name: "moveSupportPlatform",
				role: Role.notify,
			})
			.extend({
				name: "getSupportPlatformPosition",
				role: Role.notify,
			})
			.extend({
				name: "startHoming",
				role: Role.notify,
			})
			.extend({
				name: "getHomingXStatus",
				role: Role.notify,
			})
			.extend({
				name: "getHomingYStatus",
				role: Role.notify,
			})
			.extend({
				name: "getHomingZStatus",
				role: Role.notify,
			})
			.extend({
				name: "startXHoming",
				role: Role.notify,
			})
			.extend({
				name: "startXHoming",
				role: Role.notify,
			});
	}
}