/**
 * Forces TypeScript to resolve and flatten intersections and Omits into a clean object type.
 */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

type Registerer<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> = (
	listener: (arg: Interfaces[K]) => void,
) => JarvisEmitter<DoneType, ErrorType, Interfaces>;
type Resolver<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> = (
	arg: Interfaces[K],
	...rest: unknown[]
) => JarvisEmitter<DoneType, ErrorType, Interfaces>;
type Remover<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> = (
	listener?: (arg: Interfaces[K]) => void,
) => JarvisEmitter<DoneType, ErrorType, Interfaces>;
type Middleware<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> = <
	ChangedArg = Interfaces[K],
>(
	listener: (next: (arg: ChangedArg) => void, arg: Interfaces[K]) => void,
) => JarvisEmitter<DoneType, ErrorType, Simplify<Omit<Interfaces, K> & Record<K, ChangedArg>>>;

interface InterfaceEntry<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> {
	registerer: Registerer<Interfaces, K, DoneType, ErrorType>;
	resolver: Resolver<Interfaces, K, DoneType, ErrorType>;
	remover: Remover<Interfaces, K, DoneType, ErrorType>;
	middleware: Middleware<Interfaces, K, DoneType, ErrorType>;
	name: K;
	role: JarvisEmitter.Role;
	purge: () => void;
}

type ExtractJarvisEmitterDoneType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<infer DoneType, any>
	? DoneType
	: void;
type ExtractJarvisEmitterErrorType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<any, infer ErrorType>
	? ErrorType
	: Error;

declare class JarvisEmitter<
	DoneType = void,
	ErrorType = Error,
	Interfaces = JarvisEmitter.DefaultInterfaces<DoneType, ErrorType>,
> {
	constructor(interfaceDescriptor?: JarvisEmitter.Property<string, any>[]);
	on: {
		[key in keyof Interfaces]: Registerer<Interfaces, key, DoneType, ErrorType>;
	};
	call: {
		[key in keyof Interfaces]: Resolver<Interfaces, key, DoneType, ErrorType>;
	};
	off: {
		[key in keyof Interfaces]: Remover<Interfaces, key, DoneType, ErrorType>;
	};
	middleware: {
		[key in keyof Interfaces]: Middleware<Interfaces, key, DoneType, ErrorType>;
	};
	/**
	 * Re-extends an existing interface key using a descriptor without `emittedType` (preserves `Interfaces`).
	 */
	extend<K extends keyof Interfaces & string>(
		interfaceProps: JarvisEmitter.PropertyDescriptor<K> | JarvisEmitter.PropertyDescriptor<K>[],
	): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	/**
	 * Re-extends an existing key with a full `Property` (including `emittedType` / `payload()`); preserves `Interfaces`.
	 */
	extend<K extends keyof Interfaces & string, V extends any, T extends JarvisEmitter.Property<K, V>>(
		interfaceProps: T | T[],
	): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	/**
	 * Adds a new key (no `emittedType`); payload type defaults to `void`.
	 */
	extend<K extends string>(
		interfaceProps: JarvisEmitter.PropertyDescriptor<K> | JarvisEmitter.PropertyDescriptor<K>[],
	): JarvisEmitter<DoneType, ErrorType, Simplify<Omit<Interfaces, K> & Record<K, void>>>;
	/**
	 * Adds or overrides typing via `emittedType` (e.g. `payload<T>()`).
	 */
	extend<K extends string, V extends any, T extends JarvisEmitter.Property<K, V>>(
		interfaceProps: T | T[],
	): JarvisEmitter<DoneType, ErrorType, Simplify<Omit<Interfaces, T["name"]> & Record<T["name"], T["emittedType"]>>>;
	/**
	 * Pre-defines the payload type for the next `.extend()` using a `PropertyDescriptor` (no `emittedType`).
	 */
	withType<V>(): {
		extend<K extends string>(
			interfaceProps: JarvisEmitter.PropertyDescriptor<K> | JarvisEmitter.PropertyDescriptor<K>[],
		): JarvisEmitter<DoneType, ErrorType, Simplify<Omit<Interfaces, K> & Record<K, V>>>;
	};
	promise(): Promise<DoneType>;
	pipe<T extends JarvisEmitter<any, any, any>>(emitter: T): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	getRolesHandlers(
		role: JarvisEmitter.Role,
		defaultsOnly?: boolean,
	): InterfaceEntry<Interfaces, keyof Interfaces, DoneType, ErrorType>[];
	getHandlersForName<T extends keyof Interfaces>(
		name: T,
		role?: string,
	): InterfaceEntry<Interfaces, T, DoneType, ErrorType>;
	destroy(): void;

	/** Lowercase role string map (same values as {@link JarvisEmitter.Role}). Matches the runtime `static get role()` object. */
	static get role(): typeof JarvisEmitter.Role;

	static immediate(
		result?: unknown,
		role?: JarvisEmitter.Role,
		name?: string,
	): JarvisEmitter<any, any>;

	/**
	 * Wraps a function that receives a trailing callback; injects a callback that resolves `done` on the returned emitter.
	 */
	static emitify(
		fn: (...args: unknown[]) => void,
		resultsAsArray?: boolean,
		cbIndex?: number,
	): (...callArgs: unknown[]) => JarvisEmitter<any, any>;

	static emitifyFromAsync<I extends any[], O>(
		fn: (...args: I) => Promise<O>,
	): (...callArgs: I) => JarvisEmitter<O, any>;

	static some<J extends Array<JarvisEmitter<any, any>>>(
		...emitters: J
	): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]> | undefined>, never>;
	static all<J extends JarvisEmitter<any, any>[]>(
		...emitters: J
	): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]>>, ExtractJarvisEmitterErrorType<J[number]>>;

	static onUnhandledException(cb: (...args: unknown[]) => void): void;
	static offUnhandledException(cb: (...args: unknown[]) => void): void;
}

declare namespace JarvisEmitter {
	enum Role {
		event = "event",
		notify = "notify",
		done = "done",
		start = "start",
		catchException = "catch", //
		observe = "observe",
	}

	interface Property<Name extends string, Value = any> {
		name: Name;
		role: Role.event | Role.notify | Role.observe | Role.start;
		sticky?: boolean;
		stickyLast?: boolean;
		emittedType?: Value;
	}

	/**
	 * Descriptor without `emittedType` — use {@link payload} or {@link JarvisEmitter#withType} for payload typing.
	 */
	interface PropertyDescriptor<Name extends string> {
		name: Name;
		role: Role.event | Role.notify | Role.observe | Role.start;
		sticky?: boolean;
		stickyLast?: boolean;
		emittedType?: never;
	}

	/**
	 * Type-only helper for `extend()` with `emittedType`. At runtime returns `undefined` (not read by `extend`).
	 */
	function payload<T>(): T;

	interface DefaultInterfaces<DoneType = void, ErrorType = Error> {
		done: DoneType;
		error: ErrorType;
		catch: Error;
		always: DoneType | ErrorType;
		event: any;
		notify: any;
		tap: {
			name: string;
			role?: Role;
			data: any[];
		};
	}
}

export = JarvisEmitter;
