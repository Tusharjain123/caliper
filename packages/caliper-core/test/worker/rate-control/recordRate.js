/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const mockery = require('mockery');
const path = require('path');
const RecordRate = require('../../../lib/worker/rate-control/recordRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const MockRate = require('./mockRate');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const fs = require('fs');
const chai = require('chai');
chai.should();
const sinon = require('sinon');
const expect = chai.expect;

describe('RecordRate controller', () => {
    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock(path.join(__dirname, '../../../lib/worker/rate-control/noRate.js'), MockRate);
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should apply rate control to the recorded rate controller', async () => {
        const msgContent = {
            label: 'test',
            rateControl: {
                "type": "record-rate",
                "opts": {
                    "rateController": {
                        "type": "zero-rate"
                    },
                    "pathTemplate": "../tx_records_client<C>_round<R>.txt",
                    "outputFormat": "TEXT",
                    "logEnd": true
                }
            },
            workload: {
                module: 'module.js'
            },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };

        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);
        const rateController = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
        const mockRate = MockRate.createRateController();
        mockRate.reset();
        mockRate.isApplyRateControlCalled().should.equal(false);
        await rateController.applyRateControl();
        mockRate.isApplyRateControlCalled().should.equal(true);
    });

    it('should throw an error if the rate controller to record is unknown', async () => {
        const msgContent = {
            label: 'test',
            rateControl: {
                "type": "record-rate",
                "opts": {
                    "rateController": {
                        "type": "nonexistent-rate"
                    },
                    "pathTemplate": "../tx_records_client<C>_round<R>.txt",
                    "outputFormat": "TEXT",
                    "logEnd": true
                }
            },
            workload: {
                module: 'module.js'
            },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);

        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);
        (() => {
            RecordRate.createRateController(testMessage, stubStatsCollector, 0)
        }).should.throw(/Module "nonexistent-rate" could not be loaded/);
    });
    
    describe('#_exportToText Test', () => {
        it('should export recorded results in text format', async () => {
            const testMessage = new TestMessage('test', [], {
                label: 'test',
                rateControl: {
                    "type": "record-rate",
                    "opts": {
                        "rateController": {
                            "type": "zero-rate"
                        },
                        "pathTemplate": "../tx_records_client<C>_round<R>.txt",
                        "outputFormat": "TEXT",
                        "logEnd": true
                    }
                },
                workload: {
                    module: 'module.js'
                },
                testRound: 0,
                txDuration: 250,
                totalWorkers: 2
            });
            const stats = sinon.createStubInstance(TransactionStatisticsCollector);
            const controller = new RecordRate.createRateController(testMessage, stats, 0);
            controller.records = [100, 200, 300, 400, 500];
            controller._exportToText();

            const filePath = '../tx_records_client0_round0.txt'; 
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            const lines = fileContent.trim().split('\n');
            expect(lines.length).to.equal(5);
            lines.forEach((line, index) => {
                expect(parseInt(line)).to.equal((index + 1) * 100);
            });
    
            fs.unlinkSync(filePath);
        });
    });
});