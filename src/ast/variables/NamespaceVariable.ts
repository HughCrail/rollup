import Module, { AstContext } from '../../Module';
import { RenderOptions } from '../../utils/renderHelpers';
import { RESERVED_NAMES } from '../../utils/reservedNames';
import Identifier from '../nodes/Identifier';
import { UNKNOWN_PATH } from '../values';
import Variable from './Variable';

export default class NamespaceVariable extends Variable {
	context: AstContext;
	isNamespace!: true;
	memberVariables: { [name: string]: Variable } = Object.create(null);
	module: Module;

	private containsExternalNamespace = false;
	private referencedEarly = false;
	private references: Identifier[] = [];

	constructor(context: AstContext) {
		super(context.getModuleName());
		this.context = context;
		this.module = context.module;
	}

	addReference(identifier: Identifier) {
		this.references.push(identifier);
		this.name = identifier.name;
	}

	// This is only called if "UNKNOWN_PATH" is reassigned as in all other situations, either the
	// build fails due to an illegal namespace reassignment or MemberExpression already forwards
	// the reassignment to the right variable. This means we lost track of this variable and thus
	// need to reassign all exports.
	deoptimizePath() {
		for (const key in this.memberVariables) {
			this.memberVariables[key].deoptimizePath(UNKNOWN_PATH);
		}
	}

	include() {
		if (!this.included) {
			if (this.containsExternalNamespace) {
				this.context.error(
					{
						code: 'NAMESPACE_CANNOT_CONTAIN_EXTERNAL',
						id: this.module.id,
						message: `Cannot create an explicit namespace object for module "${this.context.getModuleName()}" because it contains a reexported external namespace`
					},
					undefined as any
				);
			}
			this.included = true;
			for (const identifier of this.references) {
				if (identifier.context.getModuleExecIndex() <= this.context.getModuleExecIndex()) {
					this.referencedEarly = true;
					break;
				}
			}
			if (this.context.preserveModules) {
				for (const memberName of Object.keys(this.memberVariables))
					this.memberVariables[memberName].include();
			} else {
				for (const memberName of Object.keys(this.memberVariables))
					this.context.includeVariable(this.memberVariables[memberName]);
			}
		}
	}

	initialise() {
		for (const name of this.context.getExports().concat(this.context.getReexports())) {
			if (name[0] === '*' && name.length > 1) this.containsExternalNamespace = true;
			this.memberVariables[name] = this.context.traceExport(name);
		}
	}

	renderBlock(options: RenderOptions) {
		const _ = options.compact ? '' : ' ';
		const n = options.compact ? '' : '\n';
		const t = options.indent;

		const members = Object.keys(this.memberVariables).map(name => {
			const original = this.memberVariables[name];

			if (this.referencedEarly || original.isReassigned) {
				return `${t}get ${name}${_}()${_}{${_}return ${original.getName()}${
					options.compact ? '' : ';'
				}${_}}`;
			}

			const safeName = RESERVED_NAMES[name] ? `'${name}'` : name;

			return `${t}${safeName}: ${original.getName()}`;
		});

		members.unshift(`${t}__proto__:${_}null`);
    
		if (options.namespaceToStringTag) {
			members.unshift(`${t}[Symbol.toStringTag]:${_}'Module'`);
		}

		const name = this.getName();

		const callee = options.freeze ? `/*#__PURE__*/Object.freeze` : '';
		const membersStr = members.join(`,${n}`);
		let output = `${options.varOrConst} ${name}${_}=${_}${callee}({${n}${membersStr}${n}});`;

		if (options.format === 'system' && this.exportName) {
			output += `${n}exports('${this.exportName}',${_}${name});`;
		}

		return output;
	}

	renderFirst() {
		return this.referencedEarly;
	}
}

NamespaceVariable.prototype.isNamespace = true;
