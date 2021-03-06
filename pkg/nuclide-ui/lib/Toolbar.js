'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import classnames from 'classnames';
import {React} from 'react-for-atom';

type Props = {
  children: React.Element;
  location?: 'top' | 'bottom';
};

export const Toolbar = (props: Props) => {
  const className = classnames('nuclide-ui-toolbar', {
    [`nuclide-ui-toolbar--${props.location}`]: props.location != null,
  });

  return (
    <div className={className}>
      {props.children}
    </div>
  );
};
