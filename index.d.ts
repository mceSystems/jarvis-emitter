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

type Omit<T, K> = { [key in Exclude<keyof T, K>]: T[key] };

export interface DefaultInterfaces<DoneType = void, ErrorType = Error> {
	done: DoneType;
	error: ErrorType;
	catch: Error;
	always: DoneType | ErrorType;
	event: any;
	notify: any
	tap: {
		name: string;
		role?: Role;
		data: any[];
	}
}

type Registerer<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener: (arg: Interfaces[K]) => void) => J;
type Resolver<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (arg: Interfaces[K], ...rest: unknown[]) => J;
type Remover<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener?: (arg: Interfaces[K]) => void) => J;
type Middleware<Interfaces, K extends keyof Interfaces, DoneType, ErrorType> = <ChangedArg = Interfaces[K]>(listener: (next: (arg: ChangedArg) => void, arg: Interfaces[K]) => void) =>
	JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, K> & Record<K, ChangedArg>>;

interface InterfaceEntry<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>, DoneType, ErrorType> {
	registerer: Registerer<Interfaces, K, J>;
	resolver: Resolver<Interfaces, K, J>;
	remover: Remover<Interfaces, K, J>;
	middleware: Middleware<Interfaces, K, DoneType, ErrorType>;
	name: K;
	role: Role;
	purge: Function;
}

type ExtractJarvisEmitterDoneType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<infer DoneType, any> ? DoneType : void;
type ExtractJarvisEmitterErrorType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<any, infer ErrorType> ? ErrorType : Error;

declare class JarvisEmitter<DoneType = void, ErrorType = Error, Interfaces = DefaultInterfaces<DoneType, ErrorType>> {
	constructor(interfaceDescriptor?: Property<string, any>[]);
	on: {
		[key in keyof Interfaces]: Registerer<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	call: {
		[key in keyof Interfaces]: Resolver<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	off: {
		[key in keyof Interfaces]: Remover<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	middleware: {
		[key in keyof Interfaces]: Middleware<Interfaces, key, DoneType, ErrorType>
	};
	extend<K extends string, V = K extends keyof Interfaces ? Interfaces[K] : void>(
		interfaceProps: PropertyDescriptor<K> | PropertyDescriptor<K>[]
	): JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, K> & Record<K, V>>;
	extend<K extends string, V extends any, T extends Property<K, V>>(
		interfaceProps: T | T[]
	): JarvisEmitter<DoneType, ErrorType, Omit<Interfaces, T["name"]> & { [key in T["name"]]: T["emittedType"] }>;
	promise(): Promise<DoneType>;
	pipe<T extends JarvisEmitter<any, any, any>>(emitter: T): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	getRolesHandlers(role: Role, defaultsOnly?: boolean): InterfaceEntry<Interfaces, keyof Interfaces, JarvisEmitter<DoneType, ErrorType, Interfaces>, DoneType, ErrorType>[];
	getHandlersForName<T extends keyof Interfaces>(name: T, role?: string): InterfaceEntry<Interfaces, T, JarvisEmitter<DoneType, ErrorType, Interfaces>, DoneType, ErrorType>;
	destroy(): void;
	static some<J extends Array<JarvisEmitter<any, any>>>(...emitters: J): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]> | undefined>, never>;
	static all<J extends JarvisEmitter<any, any>[]>(...emitters: J): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]>>, ExtractJarvisEmitterErrorType<J[number]>>;
	static emitifyFromAsync<I extends any[], O>(fn: (...args: I) => Promise<O>): (...callArgs: I) => JarvisEmitter<O, any>;
}

export default JarvisEmitter;
