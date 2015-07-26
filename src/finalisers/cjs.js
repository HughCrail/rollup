import getExportBlock from './shared/getExportBlock';

export default function cjs ( bundle, magicString, { exportMode }) {
	let intro = `'use strict';\n\n`;

	// TODO handle empty imports, once they're supported
	const importBlock = bundle.externalModules
		.map( module => {
			let requireStatement = `var ${module.name} = require('${module.id}');`;

			if ( module.needsDefault ) {
				requireStatement += '\n' + ( module.needsNamed ? `var ${module.name}__default = ` : `${module.name} = ` ) +
					`'default' in ${module.name} ? ${module.name}['default'] : ${module.name};`;
			}

			return requireStatement;
		})
		.join( '\n' );

	if ( importBlock ) {
		intro += importBlock + '\n\n';
	}

	magicString.prepend( intro );

	const exportBlock = getExportBlock( bundle, exportMode, 'module.exports =' );
	if ( exportBlock ) magicString.append( '\n\n' + exportBlock );

	return magicString;
}
