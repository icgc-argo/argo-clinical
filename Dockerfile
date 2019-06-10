##################################################################################
#  
#  Copyright (c) 2019. Ontario Institute for Cancer Research
#
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU Affero General Public License as
#  published by the Free Software Foundation, either version 3 of the
#  License, or (at your option) any later version.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU Affero General Public License for more details.
#
#  You should have received a copy of the GNU Affero General Public License
#  along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
##################################################################################

FROM openjdk:11-jdk-slim as builder

# Build song-server jar
WORKDIR /srv
COPY . /srv

RUN ./mvnw clean package

##################################################################################

FROM openjdk:11-jre-slim

# Paths
ENV APP_HOME /app-server
ENV APP_LOGS $APP_HOME/logs
ENV JAR_FILE  /app.jar

COPY --from=builder /srv/target/*.jar $JAR_FILE

WORKDIR $APP_HOME

CMD mkdir -p  $APP_HOME $APP_LOGS \
		&& java -Dlog.path=$APP_LOGS \
		-jar $JAR_FILE \
		--spring.config.location=classpath:/application.yml
