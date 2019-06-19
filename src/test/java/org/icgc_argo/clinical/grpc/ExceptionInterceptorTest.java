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

package org.icgc_argo.clinical.grpc;

import io.grpc.Channel;
import io.grpc.BindableService;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import io.grpc.testing.GrpcCleanupRule;
import lombok.val;
import org.icgc_argo.clinical.grpc.interceptor.EgoAuthInterceptor;
import org.icgc_argo.clinical.grpc.interceptor.ExceptionInterceptor;
import org.icgc_argo.clinical.proto.car_service.CarServiceGrpc;
import org.icgc_argo.clinical.proto.car_service.CreateCarRequest;
import org.icgc_argo.clinical.proto.car_service.CreateCarResponse;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.junit.MockitoJUnitRunner;

import java.io.IOException;

import static org.junit.Assert.*;

// GrpcCleanupRule only works with junit 4
@RunWith(MockitoJUnitRunner.class)
public class ExceptionInterceptorTest {
  private Channel channel;
  private String serverName;
  private ExceptionInterceptor interceptor;

  @Rule public final GrpcCleanupRule grpcCleanup = new GrpcCleanupRule();

  @Before
  public void setUp() {
    // Generate a unique in-process server name.
    serverName = InProcessServerBuilder.generateName();
    // Create a client channel and register for automatic graceful shutdown.
    channel = grpcCleanup.register(InProcessChannelBuilder.forName(serverName).directExecutor().build());
    interceptor = new ExceptionInterceptor();
  }

  @Test
  public void testHandleException() throws Exception {
    val service = new CarServiceGrpc.CarServiceImplBase() {
      @Override
      public void createCar(
        CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
        throw new Error("Everything is wrong");
      }
    };

    val client = setupTest(service);
    try {
      client.createCar(CreateCarRequest.getDefaultInstance());
    } catch (StatusRuntimeException e) {
      assertEquals(e.getStatus().getCode(), Status.Code.INTERNAL);
      assertEquals(e.getStatus().getDescription(), "Everything is wrong");
    }

  }

  @Test
  public void testHandleStatusRuntimeException() throws Exception {
    val service = new CarServiceGrpc.CarServiceImplBase() {
      @Override
      public void createCar(
        CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
        throw Status.CANCELLED.augmentDescription("fail").asRuntimeException();
      }
    };

    val client = setupTest(service);
    try {
      client.createCar(CreateCarRequest.getDefaultInstance());
    } catch (StatusRuntimeException e) {
      assertEquals(e.getStatus().getCode(), Status.Code.CANCELLED);
      assertEquals(e.getStatus().getDescription(), "fail");
    }

  }

  @Test
  public void testHandleNoException() throws IOException {
    val service = new CarServiceGrpc.CarServiceImplBase() {
      @EgoAuthInterceptor.EgoAuth(typesAllowed = { "ADMIN" })
      public void createCar(
        CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
        responseObserver.onNext(CreateCarResponse.getDefaultInstance());
        responseObserver.onCompleted();
      }
    };

    val client = setupTest(service);
    val result = client.createCar(CreateCarRequest.getDefaultInstance());
    assertNotNull(result);

  }

  private CarServiceGrpc.CarServiceBlockingStub setupTest(BindableService service) throws IOException {
    // Create a server, add service, start, and register for automatic graceful shutdown.
    grpcCleanup.register(
      InProcessServerBuilder.forName(serverName)
        .directExecutor()
        .addService(ServerInterceptors.intercept(service, interceptor))
        .build()
        .start());

    return CarServiceGrpc.newBlockingStub(channel);
  }
}

