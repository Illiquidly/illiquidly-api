import { Test, TestingModule } from "@nestjs/testing";
import { NftContentService } from "./nft-content.service";

describe("NftContentService", () => {
  let service: NftContentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NftContentService],
    }).compile();

    service = module.get<NftContentService>(NftContentService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
