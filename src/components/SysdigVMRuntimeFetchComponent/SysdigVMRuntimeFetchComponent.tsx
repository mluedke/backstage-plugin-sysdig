/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from 'react';
import { Table, TableColumn, Progress } from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import Alert from '@material-ui/lab/Alert';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

import {
  // annotations
  SYSDIG_CLUSTER_NAME_ANNOTATION,
  SYSDIG_NAMESPACE_ANNOTATION,
  SYSDIG_WORKLOAD_ANNOTATION,
  SYSDIG_WORKLOAD_TYPE_ANNOTATION,
  SYSDIG_CONTAINER_ANNOTATION,
  SYSDIG_CUSTOM_FILTER_ANNOTATION,

  // methods
  getStatusColorSpan,
  getChips,
  getDetails
} from '../../lib'


type RuntimeScan =   {
  isRiskSpotlightEnabled: boolean,
  mainAssetName: string,
  policyEvaluationsResult: string,
  resultId: string,
  runningVulnTotalBySeverity: {
    critical: number,
    high: number,
    low: number,
    medium: number,
    negligible: number
  },
  sbomId: string,
  scope: {
    "asset.type": string,
    "kubernetes.cluster.name": string,
    "kubernetes.namespace.name": string,
    "kubernetes.pod.container.name": string,
    "kubernetes.workload.name": string,
    "kubernetes.workload.type": string
  },
  vulnTotalBySeverity: {
    critical: number,
    high: number,
    low: number,
    medium: number,
    negligible: number
  }
};

type DenseTableProps = {
  runtimeScans: RuntimeScan[];
};

// Example image response from Sysdig scanning API
/*
"data": [
  {
    "isRiskSpotlightEnabled": true,
    "mainAssetName": "string",
    "policyEvaluationsResult": "passed",
    "resultId": "string",
    "runningVulnTotalBySeverity": {
      "critical": 0,
      "high": 0,
      "low": 0,
      "medium": 0,
      "negligible": 0
    },
    "sbomId": "string",
    "scope": {
      "asset.type": "string",
      "kubernetes.cluster.name": "string",
      "kubernetes.namespace.name": "string",
      "kubernetes.pod.container.name": "string",
      "kubernetes.workload.name": "string",
      "kubernetes.workload.type": "string"
    },
    "vulnTotalBySeverity": {
      "critical": 0,
      "high": 0,
      "low": 0,
      "medium": 0,
      "negligible": 0
    }
  },
  ...
*/

export const DenseTable = ({ runtimeScans }: DenseTableProps) => {
  const columns: TableColumn[] = [
    { title: 'Status', field: 'policyEvalStatus', width: "2%" },
    { title: 'Asset Name', field: 'asset', width: "18%"  },
    { title: 'Severity', field: 'severity', width: "35%"  },
    { title: 'In Use', field: 'inUse', width: "35%"  },
    { title: 'Details', field: 'details', width: "10%"  },
//    { title: 'Last Evaluated At', field: 'lastEvaluatedAt', width: "15%" },
//    { title: 'URL', field: "url", width: "10%"  },
  ];

  const data = runtimeScans.filter(scan => { return scan.policyEvaluationsResult != null && scan.policyEvaluationsResult != '' })
    .flatMap(scan => {
    return {
      policyEvalStatus: getStatusColorSpan(scan.policyEvaluationsResult),
      asset: scan.mainAssetName,
//      scope: JSON.stringify(scan.scope),
      severity: getChips(scan.vulnTotalBySeverity),
      inUse: getChips(scan.runningVulnTotalBySeverity),
      details: getDetails(scan)
      // convert image.lastEvaluatedAt to a date string
//      lastEvaluatedAt: getDate(image.lastEvaluatedAt * 1000),
      // https://prodmon.app.sysdig.com/secure/#/scanning/scan-results/quay.io%2Fsysdig%2Fsysdigcloud-backend%3A5.1.0.10598-sysdig-meerkat-collector/id/497c07ec287acc1800dc84a91ac1260e910c603cabc8febd754b909f406a6e26/summaries
      // url: getUrl('https://prodmon.app.sysdig.com/api/scanning/v1/images/by_id/' + image.imageId + '?fulltag=' + image.repo + ':' + image.tag),
//      url: getUrl('https://prodmon.app.sysdig.com/secure/#/scanning/scan-results/' + urlEncode(image.repo + ':' + image.tag) +' /id/' + image.imageId + '/summaries'),
    };
  });

  return (
    <Table
      title="Runtime Scan Overview"
      options={{ search: true, paging: false }}
      // sortby

      columns={columns}
      data={data}
    />
  );
};

export const SysdigVMRuntimeFetchComponent = () => {
  const { entity } = useEntity();
  const backendUrl = useApi(configApiRef).getString('backend.baseUrl');

  const { value, loading, error } = useAsync(async (): Promise<RuntimeScan[]> => {
    const timeNow = Date.now() * 1000;
    const oneWeekAgo = timeNow - 24 * 60 * 60 * 1000 * 1000;
    const annotations = entity.metadata.annotations;

    let uri = backendUrl + '/api/proxy/sysdig/secure/vulnerability/v1beta1/runtime-results';
    var name;

    if (annotations) {

      if (SYSDIG_CUSTOM_FILTER_ANNOTATION in annotations) {
        uri += '?filter=' + annotations[SYSDIG_CUSTOM_FILTER_ANNOTATION]
      } else {

        var filters = []
        
        if (SYSDIG_CLUSTER_NAME_ANNOTATION in annotations) {
          name = annotations[SYSDIG_CLUSTER_NAME_ANNOTATION]
          filters.push('kubernetes.cluster.name="' + name + '"');
        }
        
        if (SYSDIG_NAMESPACE_ANNOTATION in annotations) {
          name = annotations[SYSDIG_NAMESPACE_ANNOTATION]
          filters.push('kubernetes.namespace.name="' + name + '"');
        }

        if (SYSDIG_WORKLOAD_ANNOTATION in annotations) {
          name = annotations[SYSDIG_WORKLOAD_ANNOTATION]
          filters.push('kubernetes.workload.name="' + name + '"');
        }

        if (SYSDIG_WORKLOAD_TYPE_ANNOTATION in annotations) {
          name = annotations[SYSDIG_WORKLOAD_TYPE_ANNOTATION]
          filters.push('kubernetes.workload.type="' + name + '"');
        }

        if (SYSDIG_CONTAINER_ANNOTATION in annotations) {
          name = annotations[SYSDIG_CONTAINER_ANNOTATION]
          filters.push('kubernetes.pod.container.name="' + name + '"');
        }
        
        if (filters.length == 0) {
          return []
        }
        
        uri += '?filter=' + filters.join(' and '); 
      }
    } else {
      return [];
    }

    const requestOptions = {
      method: 'GET',
    };


    const response = await fetch(uri, requestOptions);
    const data = await response.json();
    return data.data;
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  return <DenseTable runtimeScans={value || []} />;
};