import { Test, TestingModule } from "@nestjs/testing";
import { NftContentController } from "./nft-content.controller";
import { NftContentService } from "./nft-content.service";

describe("NftContentController", () => {
  let controller: NftContentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NftContentController],
      providers: [NftContentService],
    }).compile();

    controller = module.get<NftContentController>(NftContentController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
