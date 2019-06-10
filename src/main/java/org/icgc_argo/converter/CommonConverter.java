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

package org.icgc_argo.converter;

import com.google.protobuf.BoolValue;
import com.google.protobuf.Int32Value;
import com.google.protobuf.StringValue;
import com.google.protobuf.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.mapstruct.Mapper;

@Mapper(config = ConverterConfig.class)
public interface CommonConverter {

  static String unboxStringValue(StringValue v) {
    return v.getValue();
  }

  static StringValue boxString(String s) {
    return StringValue.of(s);
  }

  static int unboxInt32Value(Int32Value v) {
    return v.getValue();
  }

  static Int32Value boxInt(int i) {
    return Int32Value.of(i);
  }

  static boolean unboxBoolValue(BoolValue v) {
    return v.getValue();
  }

  static BoolValue boxBoolean(boolean v) {
    return BoolValue.of(v);
  }

  default UUID stringToUUID(String s) {
    try {
      return UUID.fromString(s);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  default UUID stringToUUID(StringValue s) {
    return stringToUUID(s.getValue());
  }

  default String uuidToString(UUID uuid) {
    return uuid.toString();
  }

  default LocalDateTime timestampToLocalDateTime(Timestamp timestamp) {
    return LocalDateTime.ofInstant(
        Instant.ofEpochSecond(timestamp.getSeconds(), timestamp.getNanos()), ZoneId.of("UTC"));
  }

  default Timestamp localDateTimeToTimestamp(LocalDateTime dateTime) {
    Instant instant = dateTime.toInstant(ZoneOffset.UTC);
    return Timestamp.newBuilder()
        .setSeconds(instant.getEpochSecond())
        .setNanos(instant.getNano())
        .build();
  }
}
