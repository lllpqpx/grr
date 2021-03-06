import {Injectable} from '@angular/core';
import {ComponentStore} from '@ngrx/component-store';
import {HttpApiService} from '@app/lib/api/http_api_service';
import {translateFlowDescriptor} from '@app/lib/api_translation/flow';
import {Observable, of} from 'rxjs';
import {filter, map, shareReplay, switchMap, tap} from 'rxjs/operators';

import {ApiUiConfig} from '../lib/api/api_interfaces';
import {ApprovalConfig} from '../lib/models/client';
import {FlowDescriptor, FlowDescriptorMap} from '../lib/models/flow';
import {isNonNull} from '../lib/preconditions';


/** The state of the Config. */
export interface ConfigState {
  flowDescriptors?: FlowDescriptorMap;
  approvalConfig?: ApprovalConfig;
  uiConfig?: ApiUiConfig;
}

/** ComponentStore implementation for the config facade. */
@Injectable({
  providedIn: 'root',
})
export class ConfigStore extends ComponentStore<ConfigState> {
  constructor(private readonly httpApiService: HttpApiService) {
    super({});
  }

  private readonly updateFlowDescriptors =
      this.updater<ReadonlyArray<FlowDescriptor>>((state, descriptors) => {
        return {
          ...state,
          flowDescriptors: new Map(descriptors.map(fd => [fd.name, fd])),
        };
      });

  private readonly updateApprovalConfig =
      this.updater<ApprovalConfig>((state, approvalConfig) => {
        return {...state, approvalConfig};
      });

  private readonly listFlowDescriptors = this.effect<void>(
      obs$ => obs$.pipe(
          switchMap(() => this.httpApiService.listFlowDescriptors()),
          map(apiDescriptors => apiDescriptors.map(translateFlowDescriptor)),
          tap(descriptors => {
            this.updateFlowDescriptors(descriptors);
          }),
          ));

  private readonly fetchApprovalConfig = this.effect<void>(
      obs$ => obs$.pipe(
          switchMap(() => this.httpApiService.fetchApprovalConfig()),
          tap(approvalConfig => {
            this.updateApprovalConfig(approvalConfig);
          }),
          ));

  /** An observable emitting available flow descriptors. */
  readonly flowDescriptors$ = of(undefined).pipe(
      // Ensure that the query is done on subscription.
      tap(() => {
        this.listFlowDescriptors();
      }),
      switchMap(() => this.select(state => state.flowDescriptors)),
      filter(isNonNull),
      shareReplay(1),  // Ensure that the query is done just once.
  );

  /** An observable emitting the approval configuration. */
  readonly approvalConfig$ = of(undefined).pipe(
      // Ensure that the query is done on subscription.
      tap(() => {
        this.fetchApprovalConfig();
      }),
      switchMap(() => this.select(state => state.approvalConfig)),
      filter(isNonNull),
      shareReplay(1),  // Ensure that the query is done just once.
  );

  private readonly updateUiConfig =
      this.updater<ApiUiConfig>((state, uiConfig) => {
        return {...state, uiConfig};
      });

  private readonly fetchUiConfig = this.effect<void>(
      obs$ => obs$.pipe(
          switchMap(() => this.httpApiService.fetchUiConfig()),
          tap(uiConfig => {
            this.updateUiConfig(uiConfig);
          }),
          ));

  /** An observable emitting available flow descriptors. */
  readonly uiConfig$ = of(undefined).pipe(
      // Ensure that the query is done on subscription.
      tap(() => {
        this.fetchUiConfig();
      }),
      switchMap(() => this.select(state => state.uiConfig)),
      filter(isNonNull),
      shareReplay(1),  // Ensure that the query is done just once.
  );
}


/** Facade to retrieve general purpose configuration and backend data. */
@Injectable({
  providedIn: 'root',
})
export class ConfigFacade {
  constructor(private readonly store: ConfigStore) {}

  /** An observable emitting available flow descriptors. */
  readonly flowDescriptors$: Observable<FlowDescriptorMap> =
      this.store.flowDescriptors$;

  /** An observable emitting the approval configuration. */
  readonly approvalConfig$: Observable<ApprovalConfig> =
      this.store.approvalConfig$;

  /** An observable emitting the UI configuration. */
  readonly uiConfig$: Observable<ApiUiConfig> = this.store.uiConfig$;
}
