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
import Chip from '@material-ui/core/Chip';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  // annotations
  SYSDIG_CUSTOM_FILTER_ANNOTATION,
  SYSDIG_IMAGE_FREETEXT_ANNOTATION,

  // methods
  getStatusColorSpan,
  getChips
} from '../../lib'

type PipelineScan = {
  createdAt: Date,
  imageId: string,
  mainAssetName: string,
  policyEvaluationsResult: string,
  resultId: string,
  vulnTotalBySeverity: {
    critical: number,
    high: number,
    low: number,
    medium: number,
    negligible: number
  }
};

type DenseTableProps = {
  pipelineScans: PipelineScan[];
};

// Example image response from Sysdig scanning API
/*
"data": [
  {
    "createdAt": "2019-08-24T14:15:22Z",
    "imageId": "string",
    "mainAssetName": "string",
    "policyEvaluationsResult": "passed",
    "resultId": "string",
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

export const DenseTable = ({ pipelineScans }: DenseTableProps) => {
  const columns: TableColumn[] = [
    { title: 'Status', field: 'policyEvalStatus', width: "2%" },
    { title: 'Image ID', field: 'imageId', width: "23%" },
    { title: 'Asset Name', field: 'asset', width: "35%"  },
    { title: 'Vulnerabilities', field: 'vulns', width: "35%"  },
//    { title: 'Last Evaluated At', field: 'lastEvaluatedAt', width: "15%" },
//    { title: 'URL', field: "url", width: "10%"  },
  ];

  const data = pipelineScans.filter(scan => { return scan.policyEvaluationsResult != null && scan.policyEvaluationsResult != '' })
    .flatMap(scan => {
    return {
      policyEvalStatus: getStatusColorSpan(scan.policyEvaluationsResult),
      imageId: <code>{scan.imageId}</code>,
      asset: scan.mainAssetName,
      vulns: getChips(scan.vulnTotalBySeverity),
      // convert image.lastEvaluatedAt to a date string
//      lastEvaluatedAt: getDate(image.lastEvaluatedAt * 1000),
      // https://prodmon.app.sysdig.com/secure/#/scanning/scan-results/quay.io%2Fsysdig%2Fsysdigcloud-backend%3A5.1.0.10598-sysdig-meerkat-collector/id/497c07ec287acc1800dc84a91ac1260e910c603cabc8febd754b909f406a6e26/summaries
      // url: getUrl('https://prodmon.app.sysdig.com/api/scanning/v1/images/by_id/' + image.imageId + '?fulltag=' + image.repo + ':' + image.tag),
//      url: getUrl('https://prodmon.app.sysdig.com/secure/#/scanning/scan-results/' + urlEncode(image.repo + ':' + image.tag) +' /id/' + image.imageId + '/summaries'),
    };
  });

  return (
    <Table
      title="Pipeline Scan Overview"
      options={{ search: true, paging: false }}
      // sortby

      columns={columns}
      data={data}
    />
  );
};

export const SysdigVMPipelineFetchComponent = () => {
  const { entity } = useEntity();
  const backendUrl = useApi(configApiRef).getString('backend.baseUrl');

  const { value, loading, error } = useAsync(async (): Promise<PipelineScan[]> => {
    const timeNow = Date.now() * 1000;
    const oneWeekAgo = timeNow - 24 * 60 * 60 * 1000 * 1000;
    const annotations = entity.metadata.annotations;

    let uri = backendUrl + '/api/proxy/sysdig/secure/vulnerability/v1beta1/pipeline-results';
    var name;

    if (annotations) {
      if (SYSDIG_CUSTOM_FILTER_ANNOTATION in annotations) {
        uri += '?filter=' + annotations[SYSDIG_CUSTOM_FILTER_ANNOTATION]
      } else {

        var filters = []
        
        if (SYSDIG_IMAGE_FREETEXT_ANNOTATION in annotations) {
          name = annotations[SYSDIG_IMAGE_FREETEXT_ANNOTATION]
          filters.push('freeText in ("' + name + '")');
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

  return <DenseTable pipelineScans={value || []} />;
};