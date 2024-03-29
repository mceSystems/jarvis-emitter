export enum Role {
	event = "event",
	notify = "notify",
	done = "done",
	catchException = "catch",
	observe = "obsereve",
}

export interface Property<Name extends string, Value = any> {
	name: Name;
	role: Role.event | Role.notify;
	sticky?: boolean;
	stickyLast?: boolean;
	emittedType?: Value;
}

type Omit<T, K> = { [key in Exclude<keyof T, K>]: T[key] };

export interface DefaultInterfaces<DoneType = void, ErrorType = Error> {
	done: DoneType;
	error: ErrorType;
	catch: Error;
	always: DoneType | ErrorType | Error;
	event: any;
	notify: any
	tap: {
		name: string;
		role?: Role;
		data: any[];
	}
}

type Registerer<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener: (arg: Interfaces[K]) => void) => J;
type Resolver<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (arg: Interfaces[K]) => J;
type Remover<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener?: (arg: Interfaces[K]) => void) => J;
type Middleware<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = <ChangedArg extends any>(listener: (next: (arg: ChangedArg) => void, arg: Interfaces[K]) => void) =>
	JarvisEmitter<
		K extends "done" ?
		ChangedArg :
		Interfaces extends DefaultInterfaces ? Interfaces["done"] : void,
		K extends "error" ?
		ChangedArg :
		Interfaces extends DefaultInterfaces ? Interfaces["error"] : void,
		Omit<Interfaces, K> & { [key in K]: ChangedArg }
	>;

interface InterfaceEntry<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> {
	registerer: Registerer<Interfaces, K, J>;
	resolver: Resolver<Interfaces, K, J>;
	remover: Remover<Interfaces, K, J>;
	middleware: Middleware<Interfaces, K, J>;
	name: K;
	role: Role;
	purge: Function;
}

type ExtractJarvisEmitterDoneType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<infer DoneType, any> ? DoneType : void;
type ExtractJarvisEmitterErrorType<J extends JarvisEmitter<any, any>> = J extends JarvisEmitter<any, infer ErrorType> ? ErrorType : Error;

declare class JarvisEmitter<DoneType = void, ErrorType = Error, Interfaces = DefaultInterfaces<DoneType, ErrorType>> {
	constructor();
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
		[key in keyof Interfaces]: Middleware<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	extend<K extends string, V extends any, T extends Property<K, V>>(interfaceProps: T): JarvisEmitter<DoneType, ErrorType, Interfaces & { [key in T["name"]]: T["emittedType"] }>;
	promise(): Promise<DoneType>;
	pipe<T extends JarvisEmitter<any, any, any>>(emitter: T): JarvisEmitter<DoneType, ErrorType, Interfaces>;
	getRolesHandlers(role: Role): InterfaceEntry<Interfaces, keyof Interfaces, JarvisEmitter<DoneType, ErrorType, Interfaces>>[];
	getHandlersForName<T extends keyof Interfaces>(name: T, role?: string): InterfaceEntry<Interfaces, T, JarvisEmitter<DoneType, ErrorType, Interfaces>>;
	destroy(): void;
	static some<J extends Array<JarvisEmitter<any, any>>>(...emitters: J): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]> | undefined>, never>;
	static all<J extends JarvisEmitter<any, any>[]>(...emitters: J): JarvisEmitter<Array<ExtractJarvisEmitterDoneType<J[number]>>, ExtractJarvisEmitterErrorType<J[number]>>;
	static emitifyFromAsync<I extends any[], O>(fn: (...args: I) => Promise<O>): (...callArgs: I) => JarvisEmitter<O, any>;
}

export default JarvisEmitter;
