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

import addTooltip from '../../nuclide-ui/lib/add-tooltip';
import classnames from 'classnames';

type Props = {
  result: ?{
    percentage: number;
    providerName: string;
  };
  pending: boolean;
  // true iff we are currently displaying uncovered regions in the editor.
  isActive: boolean;
  onClick: Function;
};

const REALLY_BAD_THRESHOLD = 50;
const NOT_GREAT_THRESHOLD = 80;

export class StatusBarTileComponent extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
  }

  render(): ?React.Element {
    const result = this.props.result;
    if (result != null) {
      const percentage = result.percentage;
      const classes: string = classnames({
        'nuclide-type-coverage-status-bar-pending': this.props.pending,
        'nuclide-type-coverage-status-bar-ready': !this.props.pending,
        'nuclide-type-coverage-status-bar-really-bad': percentage <= REALLY_BAD_THRESHOLD,
        'nuclide-type-coverage-status-bar-not-great':
          percentage > REALLY_BAD_THRESHOLD && percentage <= NOT_GREAT_THRESHOLD,
        'nuclide-type-coverage-status-bar-good': percentage > NOT_GREAT_THRESHOLD,
        'nuclide-type-coverage-status-bar-active': this.props.isActive,
      });
      const formattedPercentage: string = `${Math.floor(percentage)}%`;
      const tooltipString = getTooltipString(formattedPercentage, result.providerName);
      return (
        <div
            style={{cursor: 'pointer'}}
            onClick={this.props.onClick}
            className={classes}
            ref={addTooltip({
              title: tooltipString,
              delay: 0,
              placement: 'top',
            })}>
          {formattedPercentage}
        </div>
      );
    } else {
      return null;
    }
  }
}

function getTooltipString(formattedPercentage: string, providerName: string): string {
  return `This file is ${formattedPercentage} covered by ${providerName}.<br/>` +
    'Click to toggle display of uncovered areas.';
}
