'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Dispatcher} from 'flux';

import {ActionType} from './FileTreeConstants';
import {debounce} from '../../nuclide-commons';
import {Disposable} from 'atom';
import FileTreeDispatcher from './FileTreeDispatcher';
import FileTreeHelpers from './FileTreeHelpers';
import FileTreeStore from './FileTreeStore';
import Immutable from 'immutable';
import {object} from '../../nuclide-commons';
import semver from 'semver';
import {repositoryForPath} from '../../nuclide-hg-git-bridge';

import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {WorkingSet} from '../../nuclide-working-sets';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/WorkingSetsStore';


let instance: ?Object;

/**
 * Implements the Flux pattern for our file tree. All state for the file tree will be kept in
 * FileTreeStore and the only way to update the store is through methods on FileTreeActions. The
 * dispatcher is a mechanism through which FileTreeActions interfaces with FileTreeStore.
 */
class FileTreeActions {
  _dispatcher: Dispatcher;
  _store: FileTreeStore;
  _subscriptionForRepository: Immutable.Map<atom$Repository, Disposable>;

  static getInstance(): FileTreeActions {
    if (!instance) {
      instance = new FileTreeActions();
    }
    return instance;
  }

  constructor() {
    this._dispatcher = FileTreeDispatcher.getInstance();
    this._store = FileTreeStore.getInstance();
    this._subscriptionForRepository = new Immutable.Map();
  }

  setCwd(rootKey: ?string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_CWD,
      rootKey,
    });
  }

  setRootKeys(rootKeys: Array<string>): void {
    const existingRootKeySet: Immutable.Set<string> = new Immutable.Set(this._store.getRootKeys());
    const addedRootKeys: Immutable.Set<string> =
      new Immutable.Set(rootKeys).subtract(existingRootKeySet);
    this._dispatcher.dispatch({
      actionType: ActionType.SET_ROOT_KEYS,
      rootKeys,
    });
    for (const rootKey of addedRootKeys) {
      this.expandNode(rootKey, rootKey);
    }
  }

  expandNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.EXPAND_NODE,
      rootKey,
      nodeKey,
    });
  }

  expandNodeDeep(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.EXPAND_NODE_DEEP,
      rootKey,
      nodeKey,
    });
  }

  deleteSelectedNodes(): void {
    this._dispatcher.dispatch({actionType: ActionType.DELETE_SELECTED_NODES});
  }

  // Makes sure a specific child exists for a given node. If it does not exist, temporarily
  // create it and initiate a fetch. This feature is exclusively for expanding to a node deep
  // in a tree.
  ensureChildNode(rootKey: string, nodeKey: string, childKey: string): void {
    if (this._store.getChildKeys(rootKey, nodeKey).indexOf(childKey) !== -1) {
      return;
    }
    this._dispatcher.dispatch({
      actionType: ActionType.CREATE_CHILD,
      rootKey,
      nodeKey,
      childKey,
    });
  }

  collapseNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.COLLAPSE_NODE,
      rootKey,
      nodeKey,
    });
  }

  collapseNodeDeep(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.COLLAPSE_NODE_DEEP,
      rootKey,
      nodeKey,
    });
  }

  toggleSelectNode(rootKey: string, nodeKey: string): void {
    let nodeKeys = this._store.getSelectedKeys(rootKey);
    if (nodeKeys.has(nodeKey)) {
      nodeKeys = nodeKeys.delete(nodeKey);
    } else {
      nodeKeys = nodeKeys.add(nodeKey);
    }
    this._dispatcher.dispatch({
      actionType: ActionType.SET_SELECTED_NODES_FOR_ROOT,
      rootKey,
      nodeKeys,
    });
  }

  setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_EXCLUDE_VCS_IGNORED_PATHS,
      excludeVcsIgnoredPaths,
    });
  }

  setHideIgnoredNames(hideIgnoredNames: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_HIDE_IGNORED_NAMES,
      hideIgnoredNames,
    });
  }

  setIgnoredNames(ignoredNames: Array<string>): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_IGNORED_NAMES,
      ignoredNames,
    });
  }

  setTrackedNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_TRACKED_NODE,
      nodeKey,
      rootKey,
    });
  }

  setUsePreviewTabs(usePreviewTabs: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_USE_PREVIEW_TABS,
      usePreviewTabs,
    });
  }

  setUsePrefixNav(usePrefixNav: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_USE_PREFIX_NAV,
      usePrefixNav,
    });
  }

  selectSingleNode(rootKey: string, nodeKey: string): void {
    const selectedKeysByRoot = {};
    selectedKeysByRoot[rootKey] = new Immutable.Set([nodeKey]);
    this._dispatcher.dispatch({
      actionType: ActionType.SET_SELECTED_NODES_FOR_TREE,
      selectedKeysByRoot,
    });
  }

  confirmNode(rootKey: string, nodeKey: string, pending: boolean = false): void {
    const isDirectory = FileTreeHelpers.isDirKey(nodeKey);
    if (isDirectory) {
      const actionType = this._store.isExpanded(rootKey, nodeKey) ?
        ActionType.COLLAPSE_NODE :
        ActionType.EXPAND_NODE;
      this._dispatcher.dispatch({
        actionType: actionType,
        nodeKey,
        rootKey,
      });
    } else {
      let openOptions = {
        activatePane: true,
        searchAllPanes: true,
      };
      // TODO: Make the following the default once Nuclide only supports Atom v1.6.0+
      if (semver.gte(atom.getVersion(), '1.6.0')) {
        openOptions = object.assign({}, openOptions, {pending: true});
      }
      atom.workspace.open(FileTreeHelpers.keyToPath(nodeKey), openOptions);
    }
  }

  keepPreviewTab() {
    // TODO: Make the following the default once Nuclide only supports Atom v1.6.0+
    if (semver.gte(atom.getVersion(), '1.6.0')) {
      const activePane = atom.workspace.getActivePane();
      if (activePane != null) {
        activePane.clearPendingItem();
      }
    } else {
      const activePaneItem = atom.workspace.getActivePaneItem();
      if (activePaneItem != null) {
        atom.commands.dispatch(atom.views.getView(activePaneItem), 'tabs:keep-preview-tab');
      }
    }
  }

  openSelectedEntrySplit(
    nodeKey: string,
    orientation: atom$PaneSplitOrientation,
    side: atom$PaneSplitSide
  ): void {
    const pane = atom.workspace.getActivePane();
    atom.workspace.openURIInPane(
      FileTreeHelpers.keyToPath(nodeKey),
      pane.split(orientation, side)
    );
  }

  setVcsStatuses(rootKey: string, vcsStatuses: {[path: string]: number}): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_VCS_STATUSES,
      rootKey,
      vcsStatuses,
    });
  }

  /**
   * Updates the root repositories to match the provided directories.
   */
  async updateRepositories(rootDirectories: Array<atom$Directory>): Promise<void> {
    const rootKeys = rootDirectories.map(
      directory => FileTreeHelpers.dirPathToKey(directory.getPath())
    );
    const rootRepos: Array<?atom$Repository> = await Promise.all(rootDirectories.map(
      directory => repositoryForPath(directory.getPath())
    ));

    // t7114196: Given the current implementation of HgRepositoryClient, each root directory will
    // always correspond to a unique instance of HgRepositoryClient. Ideally, if multiple subfolders
    // of an Hg repo are used as project roots in Atom, only one HgRepositoryClient should be
    // created.

    // Group all of the root keys by their repository, excluding any that don't belong to a
    // repository.
    const rootKeysForRepository = Immutable.List(rootKeys)
      .groupBy((rootKey, index) => rootRepos[index])
      .filter((v, k) => k != null)
      .map(v => new Immutable.Set(v));

    const prevRepos = this._store.getRepositories();

    // Let the store know we have some new repos!
    const nextRepos: Immutable.Set<atom$Repository> =
      new Immutable.Set(rootKeysForRepository.keys());
    this._dispatcher.dispatch({
      actionType: ActionType.SET_REPOSITORIES,
      repositories: nextRepos,
    });

    const removedRepos = prevRepos.subtract(nextRepos);
    const addedRepos = nextRepos.subtract(prevRepos);


    // TODO: Rewrite `_repositoryAdded` to return the subscription instead of adding it to a map as
    //       a side effect. The map can be created here with something like
    //       `subscriptions = Immutable.Map(repos).map(this._repositoryAdded)`. Since
    //       `_repositoryAdded` will no longer be about side effects, it should then be renamed.
    //       `_repositoryRemoved` could probably be inlined here. That would leave this function as
    //       the only one doing side-effects.

    // Unsubscribe from removedRepos.
    removedRepos.forEach(repo => this._repositoryRemoved(repo, rootKeysForRepository));

    // Create subscriptions for addedRepos.
    addedRepos.forEach(repo => this._repositoryAdded(repo, rootKeysForRepository));
  }

  updateWorkingSet(workingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_WORKING_SET,
      workingSet,
    });
  }

  updateOpenFilesWorkingSet(openFilesWorkingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_OPEN_FILES_WORKING_SET,
      openFilesWorkingSet,
    });
  }

  updateWorkingSetsStore(workingSetsStore: ?WorkingSetsStore): void {
    this._dispatcher.dispatch({
      actionType: ActionType.SET_WORKING_SETS_STORE,
      workingSetsStore,
    });
  }

  startEditingWorkingSet(editedWorkingSet: WorkingSet): void {
    this._dispatcher.dispatch({
      actionType: ActionType.START_EDITING_WORKING_SET,
      editedWorkingSet,
    });
  }

  finishEditingWorkingSet(): void {
    this._dispatcher.dispatch({
      actionType: ActionType.FINISH_EDITING_WORKING_SET,
    });
  }

  checkNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.CHECK_NODE,
      rootKey,
      nodeKey,
    });
  }

  uncheckNode(rootKey: string, nodeKey: string): void {
    this._dispatcher.dispatch({
      actionType: ActionType.UNCHECK_NODE,
      rootKey,
      nodeKey,
    });
  }

  async _repositoryAdded(
    repo: atom$Repository,
    rootKeysForRepository: Immutable.Map<atom$Repository, Immutable.Set<string>>,
  ): Promise<void> {
    // For now, we only support HgRepository objects.
    if (repo.getType() !== 'hg') {
      return;
    }

    const hgRepo = ((repo: any): HgRepositoryClient);

    // At this point, we assume that repo is a Nuclide HgRepositoryClient.

    // First, get the output of `hg status` for the repository.
    const {hgConstants} = require('../../nuclide-hg-repository-base');
    // TODO(mbolin): Verify that all of this is set up correctly for remote files.
    const repoRoot = hgRepo.getWorkingDirectory();
    const statusCodeForPath = await hgRepo.getStatuses([repoRoot], {
      hgStatusOption: hgConstants.HgStatusOption.ONLY_NON_IGNORED,
    });

    // From the initial result of `hg status`, record the status code for every file in
    // statusCodeForPath in the statusesToReport map. If the file is modified, also mark every
    // parent directory (up to the repository root) of that file as modified, as well. For now, we
    // mark only new files, but not new directories.
    const statusesToReport = {};
    statusCodeForPath.forEach((statusCode, path) => {
      if (hgRepo.isStatusModified(statusCode)) {
        statusesToReport[path] = statusCode;

        // For modified files, every parent directory should also be flagged as modified.
        let nodeKey: string = path;
        const keyForRepoRoot = FileTreeHelpers.dirPathToKey(repoRoot);
        do {
          const parentKey = FileTreeHelpers.getParentKey(nodeKey);
          if (parentKey == null) {
            break;
          }

          nodeKey = parentKey;
          if (statusesToReport.hasOwnProperty(nodeKey)) {
            // If there is already an entry for this parent file in the statusesToReport map, then
            // there is no reason to continue exploring ancestor directories.
            break;
          } else {
            statusesToReport[nodeKey] = hgConstants.StatusCodeNumber.MODIFIED;
          }
        } while (nodeKey !== keyForRepoRoot);
      } else if (statusCode === hgConstants.StatusCodeNumber.ADDED) {
        statusesToReport[path] = statusCode;
      }
    });
    for (const rootKeyForRepo of rootKeysForRepository.get(hgRepo)) {
      this.setVcsStatuses(rootKeyForRepo, statusesToReport);
    }

    // TODO: Call getStatuses with <visible_nodes, hgConstants.HgStatusOption.ONLY_IGNORED>
    // to determine which nodes in the tree need to be shown as ignored.

    // Now that the initial VCS statuses are set, subscribe to changes to the Repository so that the
    // VCS statuses are kept up to date.
    const subscription = hgRepo.onDidChangeStatuses(
      // t8227570: If the user is a "nervous saver," many onDidChangeStatuses will get fired in
      // succession. We should probably explore debouncing this in HgRepositoryClient itself.
      debounce(
        this._onDidChangeStatusesForRepository.bind(this, hgRepo, rootKeysForRepository),
        /* wait */ 1000,
        /* immediate */ false,
      )
    );

    this._subscriptionForRepository = this._subscriptionForRepository.set(hgRepo, subscription);
  }

  _onDidChangeStatusesForRepository(
    repo: HgRepositoryClient,
    rootKeysForRepository: Immutable.Map<atom$Repository, Immutable.Set<string>>,
  ): void {
    for (const rootKey of rootKeysForRepository.get(repo)) {
      const statusForNodeKey = {};
      for (const fileTreeNode of this._store.getVisibleNodes(rootKey)) {
        const {nodeKey} = fileTreeNode;
        statusForNodeKey[nodeKey] = fileTreeNode.isContainer
          ? repo.getDirectoryStatus(nodeKey)
          : statusForNodeKey[nodeKey] = repo.getCachedPathStatus(nodeKey);
      }
      this.setVcsStatuses(rootKey, statusForNodeKey);
    }
  }

  _repositoryRemoved(repo: atom$Repository) {
    const disposable = this._subscriptionForRepository.get(repo);
    if (!disposable) {
      // There is a small chance that the add/remove of the Repository could happen so quickly that
      // the entry for the repo in _subscriptionForRepository has not been set yet.
      // TODO: Report a soft error for this.
      return;
    }

    this._subscriptionForRepository = this._subscriptionForRepository.delete(repo);
    disposable.dispose();
  }

}

module.exports = FileTreeActions;