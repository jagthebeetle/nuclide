'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {React} from 'react-for-atom';

type DatatipComponentProps = {
  word: string;
};

export function makeSampleDatatipComponent(word: string): ReactClass {
  return () => <SampleDatatipComponent word={word} />;
}

const SampleDatatipComponent = (props: DatatipComponentProps) => {
  return <div>I am a Datatip for "{props.word}"</div>;
};
