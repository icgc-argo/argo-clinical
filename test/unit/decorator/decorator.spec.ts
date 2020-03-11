import { ProtectTestEndpoint } from '../../../src/decorators/index';
import { initConfigs } from '../../../src/config';
import chai from 'chai';

describe('decorator', () => {
  before(() => {
    initConfigs({
      mongoPassword() {
        return '';
      },
      mongoUser() {
        return '';
      },
      mongoUrl: () => {
        return '';
      },
      initialSchemaVersion() {
        return '';
      },
      schemaName() {
        return 'schemaName';
      },
      jwtPubKey() {
        return 'TEST_PUB_KEY';
      },
      jwtPubKeyUrl() {
        return '';
      },
      schemaServiceUrl() {
        return `file://${__dirname}/stub-schema.json`;
      },
      testApisDisabled() {
        return true;
      },
      kafkaMessagingEnabled() {
        return false;
      },
      kafkaBrokers() {
        return new Array<string>();
      },
      kafkaClientId() {
        return '';
      },
      kafkaTopicProgramUpdate() {
        return '';
      },
      kafkaTopicProgramUpdateConfigPartitions(): number {
        return NaN;
      },
      kafkaTopicProgramUpdateConfigReplications(): number {
        return NaN;
      },
    });
  });

  class MockResponse {
    _status: number = 0;

    status(s: number): MockResponse {
      this._status = s;
      return this;
    }

    send(body: string): MockResponse {
      console.log('sent');
      return this;
    }
  }

  class TestClass {
    @ProtectTestEndpoint()
    public callapi(req: object, response: MockResponse): string {
      return 'response';
    }
  }

  it('ProtectTestEndpoint() should be called', function() {
    const testClass = new TestClass();
    const r = new MockResponse();
    testClass.callapi({}, r);
    chai.expect(r._status).to.eq(405);
  });
});
