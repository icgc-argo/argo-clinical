/*
 * Copyright (c) 2019. Ontario Institute for Cancer Research
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

package org.icgc_argo.clinical.util;

import static com.github.lalyos.jfiglet.FigletFont.convertOneLine;
import static java.util.Arrays.stream;

import java.io.PrintStream;
import lombok.SneakyThrows;
import lombok.val;
import org.springframework.boot.Banner;
import org.springframework.boot.ResourceBanner;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ByteArrayResource;

public class ProjectBanner implements Banner {

  /** Other fonts can be found at http://www.figlet.org/examples.html */
  private static final String BANNER_FONT_LOC = "/banner-fonts/slant.flf";

  @Override
  @SneakyThrows
  public void printBanner(Environment environment, Class<?> sourceClass, PrintStream out) {
    val text = generateBannerText(environment);
    val resource = new ByteArrayResource(text.getBytes());
    val resourceBanner = new ResourceBanner(resource);
    resourceBanner.printBanner(environment, sourceClass, out);
  }

  @SneakyThrows
  private static String generateBannerText(Environment env) {
    val applicationName = env.getProperty("server.banner.text");
    val text = convertOneLine("classpath:" + BANNER_FONT_LOC, applicationName);
    val sb = new StringBuilder();
    stream(text.split("\n")).forEach(t -> sb.append("${Ansi.GREEN} ").append(t).append("\n"));
    sb.append("${Ansi.RED}  :: Spring Boot${spring-boot.formatted-version} :: ${Ansi.DEFAULT}\n");
    return sb.toString();
  }
}
