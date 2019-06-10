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

package org.icgc_argo.grpc;

import static org.hamcrest.CoreMatchers.instanceOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.fail;
import static org.mockito.BDDMockito.given;

import org.icgc_argo.grpc.interceptor.EgoAuthInterceptor;
import org.icgc_argo.security.EgoSecurity;
import bio.overture.proto.car_service.CarServiceGrpc;
import bio.overture.proto.car_service.CreateCarRequest;
import bio.overture.proto.car_service.CreateCarResponse;
import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.ClientCall;
import io.grpc.ClientInterceptor;
import io.grpc.ForwardingClientCall;
import io.grpc.Metadata;
import io.grpc.MethodDescriptor;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import io.grpc.stub.StreamObserver;
import io.grpc.testing.GrpcCleanupRule;
import java.io.IOException;
import java.util.Optional;
import lombok.val;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

// GrpcCleanupRule only works with junit 4
@RunWith(MockitoJUnitRunner.class)
public class EgoAuthInterceptorTest {

  @Mock private EgoSecurity egoSecurity;

  @Mock private EgoSecurity.EgoToken egoToken;

  private Channel channel;

  private String serverName;

  private EgoSecurity.EgoToken egoTokenSpy;

  @Rule public final GrpcCleanupRule grpcCleanup = new GrpcCleanupRule();

  @Before
  public void setUp() {
    // Generate a unique in-process server name.
    serverName = InProcessServerBuilder.generateName();
    // Create a client channel and register for automatic graceful shutdown.
    channel =
        grpcCleanup.register(InProcessChannelBuilder.forName(serverName).directExecutor().build());
  }

  @Test
  public void egoAuthInterceptor_setEgoToken() throws Exception {
    CarServiceGrpc.CarServiceImplBase programServiceImplBase =
        new CarServiceGrpc.CarServiceImplBase() {
          @Override
          public void createCar(
              CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
            EgoAuthInterceptorTest.this.egoTokenSpy = EgoAuthInterceptor.EGO_TOKEN_KEY.get();
            responseObserver.onNext(CreateCarResponse.getDefaultInstance());
            responseObserver.onCompleted();
          }
        };

    // Create a server, add service, start, and register for automatic graceful shutdown.
    grpcCleanup.register(
        InProcessServerBuilder.forName(serverName)
            .directExecutor()
            .addService(
                ServerInterceptors.intercept(
                    programServiceImplBase, new EgoAuthInterceptor(egoSecurity)))
            .build()
            .start());

    val jwtClientInterceptor = new JwtClientInterceptor();
    val blockingStub =
        CarServiceGrpc.newBlockingStub(channel).withInterceptors(jwtClientInterceptor);

    jwtClientInterceptor.token = "123";
    given(egoSecurity.verifyToken("123")).willReturn(Optional.of(egoToken));

    blockingStub.createCar(CreateCarRequest.getDefaultInstance());
    assertNotNull(this.egoTokenSpy);

    given(egoSecurity.verifyToken("321")).willReturn(Optional.empty());
    jwtClientInterceptor.token = "321";
    blockingStub.createCar(CreateCarRequest.getDefaultInstance());
    assertNull(this.egoTokenSpy);
  }

  class JwtClientInterceptor implements ClientInterceptor {
    private String token;

    @Override
    public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
        MethodDescriptor<ReqT, RespT> method, CallOptions callOptions, Channel next) {
      return new ForwardingClientCall.SimpleForwardingClientCall<>(
          next.newCall(method, callOptions)) {
        @Override
        public void start(Listener<RespT> responseListener, Metadata headers) {
          headers.put(EgoAuthInterceptor.JWT_METADATA_KEY, token);
          super.start(responseListener, headers);
        }
      };
    }
  }

  @Test
  public void egoAuthInterceptor_egoAuthAnnotation() throws IOException {
    CarServiceGrpc.CarServiceImplBase target =
        new CarServiceGrpc.CarServiceImplBase() {
          @EgoAuthInterceptor.EgoAuth(typesAllowed = {"ADMIN"})
          public void createCar(
              CreateCarRequest request, StreamObserver<CreateCarResponse> responseObserver) {
            responseObserver.onNext(CreateCarResponse.getDefaultInstance());
            responseObserver.onCompleted();
          }
        };
    AspectJProxyFactory factory = new AspectJProxyFactory(target);
    factory.setProxyTargetClass(true);
    factory.addAspect(EgoAuthInterceptor.EgoAuth.EgoAuthAspect.class);
    CarServiceGrpc.CarServiceImplBase proxy = factory.getProxy();

    // Create a server, add service, start, and register for automatic graceful shutdown.
    grpcCleanup.register(
        InProcessServerBuilder.forName(serverName)
            .directExecutor()
            .addService(ServerInterceptors.intercept(proxy, new EgoAuthInterceptor(egoSecurity)))
            .build()
            .start());
    val jwtClientInterceptor = new JwtClientInterceptor();
    val blockingStub =
        CarServiceGrpc.newBlockingStub(channel).withInterceptors(jwtClientInterceptor);

    try {
      jwtClientInterceptor.token = "123";
      given(egoSecurity.verifyToken("123")).willReturn(Optional.empty());
      blockingStub.createCar(CreateCarRequest.getDefaultInstance());
      fail("Expect an status runtime exception to be thrown");
    } catch (StatusRuntimeException e) {
      assertEquals(e.getStatus(), Status.fromCode(Status.Code.UNAUTHENTICATED));
    }

    try {
      given(egoSecurity.verifyToken("123")).willReturn(Optional.of(egoToken));
      given(egoToken.getType()).willReturn("USER");
      blockingStub.createCar(CreateCarRequest.getDefaultInstance());
      fail("Expect an status runtime exception to be thrown");
    } catch (StatusRuntimeException e) {
      assertEquals(e.getStatus(), Status.fromCode(Status.Code.PERMISSION_DENIED));
    }

    given(egoSecurity.verifyToken("123")).willReturn(Optional.of(egoToken));
    given(egoToken.getType()).willReturn("ADMIN");
    val resp = blockingStub.createCar(CreateCarRequest.getDefaultInstance());
    assertThat(resp, instanceOf(CreateCarResponse.class));
  }
}
