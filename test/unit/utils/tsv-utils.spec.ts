import chai from 'chai';
import 'deep-equal-in-any-order';
import { TsvUtils } from '../../../src/utils';

chai.use(require('deep-equal-in-any-order'));

describe('tsv-utils', () => {
  describe('tsv-parser', () => {
    it.only('should remove qouble quotes for excel compatibility', () => {
      // some example values after exported out of excel
      const content = ` \
         header1\theader2 \n \
         TEST\t"Methylcellulose ""450"" 500 mg oral tablet" \n \
         TEST\t"transparent dressing 4 3/8"" X 5"" TOPICAL BANDAGE" \n \
         TEST\t"Health Care America Insulin Syringe 29gx1/2"""
        `;
      const jsonContent = TsvUtils.parseTsvToJson(content);

      const baseJsoncontent = { header1: 'TEST' };
      const expectedJsonContent = [
        { ...baseJsoncontent, header2: 'Methylcellulose "450" 500 mg oral tablet' },
        { ...baseJsoncontent, header2: 'transparent dressing 4 3/8" X 5" TOPICAL BANDAGE' },
        { ...baseJsoncontent, header2: 'Health Care America Insulin Syringe 29gx1/2"' },
      ];

      chai.expect(jsonContent).to.deep.equalInAnyOrder(expectedJsonContent);
    });
  });
});
