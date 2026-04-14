export enum Role {
	event = "event",
	notify = "notify",
	done = "done",
	start = "start",
	catchException = "catch", //
	observe = "observe",
}

export interface Property<Name extends string, Value = any> {
	name: Name;
	role: Role.event | Role.notify | Role.observe | Role.start;
	sticky?: boolean;
	stickyLast?: boolean;
	emittedType?: Value;
}

export interface PropertyDescriptor<Name extends string> {
	name: Name;
	role: Role.event | Role.notify | Role.observe | Role.start;
	sticky?: boolean;
	stickyLast?: boolean;
}

export interface DefaultInterfaces<DoneType = void, ErrorType = Error> {
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
) => JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, K> & Record<K, ChangedArg>>;

interface InterfaceEntry<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> {
	registerer: Registerer<Interfaces, K, DoneType, ErrorType>;
	resolver: Resolver<Interfaces, K, DoneType, ErrorType>;
	remover: Remover<Interfaces, K, DoneType, ErrorType>;
	middleware: Middleware<Interfaces, K, DoneType, ErrorType>;
	name: K;
	role: Role;
	purge: Function;
}

type ExtractJarvisEmitterDoneType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<infer DoneType, any>
	? DoneType
	: void;
type ExtractJarvisEmitterErrorType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<any, infer ErrorType>
	? ErrorType
	: Error;

declare class JarvisEmitter<DoneType = void, ErrorType = Error, Interfaces = DefaultInterfaces<DoneType, ErrorType>> {
	constructor(interfaceDescriptor?: Property<string, any>[]);
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
	 * Adds named interfaces. Type parameter `V` defaults to `void` for keys not already on `Interfaces`,
	 * and to the existing property type when `K` is already a key of `Interfaces`.
	 *
	 * When `K` is already in `Interfaces`, the return type is kept flat (no Omit/Record wrapping)
	 * to avoid deeply nested types in long `.extend()` chains.
	 */
	extend<K extends keyof Interfaces & string>(
		interfaceProps: PropertyDescriptor<K> | PropertyDescriptor<K>[],
	): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	extend<K extends string, V = K extends keyof Interfaces ? Interfaces[K] : void>(
		interfaceProps: PropertyDescriptor<K> | PropertyDescriptor<K>[],
	): JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, K> & Record<K, V>>;
	extend<K extends keyof Interfaces & string, V extends any, T extends Property<K, V>>(
		interfaceProps: T | T[],
	): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	extend<K extends string, V extends any, T extends Property<K, V>>(
		interfaceProps: T | T[],
	): JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, T["name"]> & Record<T["name"], T["emittedType"]>>;
	promise(): Promise<DoneType>;
	pipe<T extends JarvisEmitter<any, any, any>>(emitter: T): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	getRolesHandlers(
		role: Role,
		defaultsOnly?: boolean,
	): InterfaceEntry<Interfaces, keyof Interfaces, DoneType, ErrorType>[];
	getHandlersForName<T extends keyof Interfaces>(
		name: T,
		role?: string,
	): InterfaceEntry<Interfaces, T, DoneType, ErrorType>;
	destroy(): void;
	static some<J extends Array<JarvisEmitter<any, any>>>(
		...emitters: J
	): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]> | undefined>, never>;
	static all<J extends JarvisEmitter<any, any>[]>(
		...emitters: J
	): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]>>, ExtractJarvisEmitterErrorType<J[number]>>;
	static emitifyFromAsync<I extends any[], O>(
		fn: (...args: I) => Promise<O>,
	): (...callArgs: I) => JarvisEmitter<O, any>;
}

export default JarvisEmitter;
