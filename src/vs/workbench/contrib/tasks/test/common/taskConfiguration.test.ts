/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepEqual, strictEqual } from 'assert';
import { IStringDictionary } from 'vs/base/common/collections';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ApplyToKind, INamedProblemMatcher } from 'vs/workbench/contrib/tasks/common/problemMatcher';
import { IParseContext, ProblemMatcherConverter } from 'vs/workbench/contrib/tasks/common/taskConfiguration';

class TestParseContext implements Partial<IParseContext> {
	namedProblemMatchers?: IStringDictionary<INamedProblemMatcher> | undefined;
}

class TestNamedProblemMatcher implements Partial<INamedProblemMatcher> {
}


suite.only('Task Configuration Test', () => {
	let instantiationService: TestInstantiationService;
	let parseContext: IParseContext;
	let namedProblemMatcher: INamedProblemMatcher;
	setup(() => {
		instantiationService = new TestInstantiationService();
		namedProblemMatcher = instantiationService.createInstance(TestNamedProblemMatcher);
		namedProblemMatcher.name = 'real';
		namedProblemMatcher.label = 'real label';
		parseContext = instantiationService.createInstance(TestParseContext);
		parseContext.namedProblemMatchers = {
			'real': namedProblemMatcher
		};
	});
	suite('ProblemMatcherConverter', () => {
		test('returns [] and an error for an unknown problem matcher', () => {
			const result = (ProblemMatcherConverter.from('$fake', parseContext));
			deepEqual(result.value, []);
			strictEqual(result.errors?.length, 1);
		});
		test('returns config for a known problem matcher', () => {
			const result = (ProblemMatcherConverter.from('$real', parseContext));
			strictEqual(result.errors?.length, 0);
			deepEqual(result.value, [{ "label": "real label" }]);
		});
		test('returns config for a known problem matcher including applyTo', () => {
			namedProblemMatcher.applyTo = ApplyToKind.closedDocuments;
			const result = (ProblemMatcherConverter.from('$real', parseContext));
			strictEqual(result.errors?.length, 0);
			deepEqual(result.value, [{ "label": "real label", "applyTo": ApplyToKind.closedDocuments }]);
		});
	});
});
