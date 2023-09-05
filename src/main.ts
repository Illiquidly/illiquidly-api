import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import * as helmet from "helmet";
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle("Illiquidlabs API")
    .setDescription("The Illiquidlabs API description")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("", app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(parseInt(process.env.PORT));
}
bootstrap();
