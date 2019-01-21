export enum Role {
	event = "event",
	notify = "notify",
	done = "done",
	catchException = "catch"
}

export interface Property<Name extends string, Value = any> {
	name: Name;
	role: Role.event | Role.notify;
	sticky?: boolean;
	emittedType?: Value;
}

interface DefaultInterfaces<DoneType = void, ErrorType = Error> {
	done: DoneType;
	error: ErrorType;
	catch: Error;
	always: DoneType | ErrorType | Error;
	event: any;
	notify: any
}

type Registerer<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener: (arg: Interfaces[K]) => void) => J;
type Resolver<Interfaces, K extends keyof Interfaces> = (listener: (arg: Interfaces[K]) => void) => void;
type Remover<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener: (arg: Interfaces[K]) => void) => J;
type Middleware<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> = (listener: (arg: Interfaces[K]) => void) => J;

interface InterfaceEntry<Interfaces, K extends keyof Interfaces, J extends JarvisEmitter<any, any, Interfaces>> {
	registerer: Registerer<Interfaces, K, J>;
	resolver: Resolver<Interfaces, K>;
	remover: Remover<Interfaces, K, J>;
	middleware: Middleware<Interfaces, K, J>;
	name: K;
	role: Role;
}

declare class JarvisEmitter<DoneType = void, ErrorType = Error, Interfaces = DefaultInterfaces<DoneType, ErrorType>> {
	constructor();
	on: {
		[key in keyof Interfaces]: Registerer<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	call: {
		[key in keyof Interfaces]: Resolver<Interfaces, key>
	};
	off: {
		[key in keyof Interfaces]: Remover<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	middleware: {
		[key in keyof Interfaces]: Middleware<Interfaces, key, JarvisEmitter<DoneType, ErrorType, Interfaces>>
	};
	extend<K extends string, V extends any, T extends Property<K, V>>(interfaceProps: T): JarvisEmitter<DoneType, ErrorType, Interfaces & { [key in T["name"]]: T["emittedType"] }>;
	promise(): Promise<DoneType>;
	pipe<T extends JarvisEmitter>(emitter: T): T;
	getRolesHandlers(role: Role): InterfaceEntry<Interfaces, keyof Interfaces, JarvisEmitter<DoneType, ErrorType, Interfaces>>[];
	getHandlersForName<T extends keyof Interfaces>(name: T): InterfaceEntry<Interfaces, T, JarvisEmitter<DoneType, ErrorType, Interfaces>>;
}

export default JarvisEmitter;